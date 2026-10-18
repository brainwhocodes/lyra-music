import { describe, expect, it } from 'vitest';
import { remainingStreamErrors, type StreamRequestEvidence } from '../helpers/stream-error-evidence';

const makeRequest = (errorText = 'net::ERR_ABORTED'): StreamRequestEvidence => ({
  url: () => 'http://localhost/api/tracks/fixture/stream', method: () => 'GET', failure: () => ({ errorText }),
});
const error = 'GET http://localhost/api/tracks/fixture/stream: net::ERR_ABORTED';
describe('identity-qualified decoder cleanup evidence', () => {
  it('accounts for two distinct attempts at the same URL without losing multiplicity', () => {
    const first = makeRequest(), second = makeRequest();
    expect(remainingStreamErrors([error, error], [first, second], [first, second], new Set([first, second]))).toEqual([]);
  });
  it('rejects an unqualified abort even when another request at its URL is qualified', () => {
    const first = makeRequest(), extra = makeRequest();
    expect(() => remainingStreamErrors([error], [first, extra], [extra], new Set([first]))).toThrow('Unqualified');
  });
  it('rejects an extra request even if it has no failure event', () => {
    const first = makeRequest(), extra = makeRequest();
    expect(() => remainingStreamErrors([], [first, extra], [], new Set([first]))).toThrow('Unqualified');
  });
  it('rejects connection failures and duplicate events', () => {
    const request = makeRequest('net::ERR_CONNECTION_RESET');
    expect(() => remainingStreamErrors([error], [request], [request], new Set([request]))).toThrow('Unexpected');
    const abort = makeRequest();
    expect(() => remainingStreamErrors([error, error], [abort], [abort, abort], new Set([abort]))).toThrow('Duplicate');
  });
  it('retains unrelated errors and unmatched extra abort occurrences', () => {
    const request = makeRequest();
    expect(remainingStreamErrors([error, error, '500 /api/library'], [request], [request], new Set([request])))
      .toEqual([error, '500 /api/library']);
  });
  it('rejects a qualified failure missing its guard occurrence', () => {
    const request = makeRequest();
    expect(() => remainingStreamErrors([], [request], [request], new Set([request]))).toThrow('exact guard occurrence');
  });
});
