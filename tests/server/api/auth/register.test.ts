import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "~/server/db";
import { users } from "~/server/db/schema";
import register from "~/server/api/auth/register.post";
import { verifyPassword } from "~/server/utils/auth";
import { migrateTestDatabase } from "../../../helpers/database";
import { serveHandler } from "../../../helpers/http";

describe("registration HTTP contract", () => {
  let server: Awaited<ReturnType<typeof serveHandler>>;
  const valid = {
    name: "Listener",
    email: "new@example.test",
    password: "securepass123",
    accessCode: "local-access",
  };
  beforeAll(async () => {
    vi.stubGlobal("useRuntimeConfig", () => ({
      jwtSecret: "test-secret-not-for-real-accounts",
      secretAccessCode: "local-access",
    }));
    migrateTestDatabase(db.$client);
    server = await serveHandler("/api/auth/register", register);
  });
  afterAll(async () => {
    await server?.close();
    db.$client.close();
    vi.unstubAllGlobals();
  });
  const request = (body: unknown) =>
    fetch(`${server.url}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  it.each([{ email: "invalid" }, { password: "short" }, { name: "" }])(
    "rejects invalid input: %j",
    async (patch) => {
      expect((await request({ ...valid, ...patch })).status).toBe(400);
    },
  );
  it("rejects an incorrect access code", async () => {
    expect((await request({ ...valid, accessCode: "wrong" })).status).toBe(401);
  });
  it("does not persist an account or issue a cookie when its signing key is missing", async () => {
    vi.stubGlobal("useRuntimeConfig", () => ({
      jwtSecret: "",
      secretAccessCode: "local-access",
    }));
    try {
      const response = await request({
        ...valid,
        email: "unconfigured@example.test",
      });
      expect(response.status).toBe(500);
      expect(response.headers.get("set-cookie")).toBeNull();
      expect(
        db
          .select()
          .from(users)
          .all()
          .some((user) => user.email === "unconfigured@example.test"),
      ).toBe(false);
    } finally {
      vi.stubGlobal("useRuntimeConfig", () => ({
        jwtSecret: "test-secret-not-for-real-accounts",
        secretAccessCode: "local-access",
      }));
    }
  });
  it("persists a password hash and issues a session, then rejects duplicates", async () => {
    const response = await request(valid);
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(await response.json()).toHaveProperty("token");
    const user = db.select().from(users).get()!;
    expect(user.passwordHash).not.toBe(valid.password);
    expect(
      (await verifyPassword(valid.password, user.passwordHash)).success,
    ).toBe(true);
    expect((await request(valid)).status).toBe(400);
  });
});
