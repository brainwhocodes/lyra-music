import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { defineEventHandler } from "h3";
import jwt from "jsonwebtoken";
import {
  generateToken,
  isAuthenticated,
  verifyToken,
} from "../../server/utils/auth";
import { serveHandler } from "../helpers/http";

const validSecret = "isolated-auth-configuration-test-secret";
const user = {
  userId: "listener",
  email: "listener@example.test",
  name: "Listener",
};
const configure = (jwtSecret: unknown) =>
  vi.stubGlobal("useRuntimeConfig", () => ({ jwtSecret }));
afterEach(() => vi.unstubAllGlobals());

describe("runtime authentication configuration", () => {
  it.each([
    undefined,
    null,
    "",
    " ".repeat(40),
    "x".repeat(31),
    "development-secret",
    "replace-with-a-random-32-character-secret",
    "example-secret-for-production-change-me",
  ])("fails closed for an unsafe key: %s", (secret) => {
    configure(secret);
    expect(() => generateToken(user)).toThrow(/NUXT_JWT_SECRET/);
    const token = jwt.sign(
      user,
      typeof secret === "string" && secret ? secret : validSecret,
    );
    expect(verifyToken(token)).toBeNull();
  });
  it("accepts a configured key and rejects tokens after runtime key rotation", () => {
    configure(validSecret);
    const token = generateToken(user);
    expect(verifyToken(token)).toMatchObject(user);
    configure("a-different-isolated-signing-key-for-tests");
    expect(verifyToken(token)).toBeNull();
  });
  it("rejects expired tokens, different algorithms and missing identity claims", () => {
    configure(validSecret);
    expect(
      verifyToken(jwt.sign(user, validSecret, { expiresIn: -1 })),
    ).toBeNull();
    expect(
      verifyToken(jwt.sign(user, validSecret, { algorithm: "HS384" })),
    ).toBeNull();
    expect(verifyToken(jwt.sign({ userId: "" }, validSecret))).toBeNull();
    expect(verifyToken(jwt.sign("not a user object", validSecret))).toBeNull();
  });
});

describe("asynchronous authentication helper over real HTTP", () => {
  let server: Awaited<ReturnType<typeof serveHandler>>;
  beforeAll(async () => {
    server = await serveHandler(
      "/session",
      defineEventHandler(async (event) => ({
        authenticated: await isAuthenticated(event),
      })),
    );
  });
  afterAll(async () => {
    await server.close();
  });
  it("reports anonymous and malformed sessions as false, never the truthiness of a Promise", async () => {
    configure(validSecret);
    expect(await (await fetch(server.url + "/session")).json()).toEqual({
      authenticated: false,
    });
    expect(
      await (
        await fetch(server.url + "/session", {
          headers: { cookie: "auth_token=invalid" },
        })
      ).json(),
    ).toEqual({ authenticated: false });
  });
  it("accepts real cookie and bearer sessions but rejects them if configuration becomes invalid", async () => {
    configure(validSecret);
    const token = generateToken(user);
    for (const headers of [
      { cookie: "auth_token=" + token },
      { authorization: "Bearer " + token },
    ]) {
      expect(
        await (await fetch(server.url + "/session", { headers })).json(),
      ).toEqual({ authenticated: true });
    }
    configure("development-secret");
    expect(
      await (
        await fetch(server.url + "/session", {
          headers: { cookie: "auth_token=" + token },
        })
      ).json(),
    ).toEqual({ authenticated: false });
  });
});
