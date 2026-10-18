import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '~/server/utils/auth';

describe('local password hashing', () => {
  it('uses salted hashes and rejects wrong passwords and unsupported hashes', async () => {
    const hash = await hashPassword('correct password');
    expect(hash).not.toEqual(await hashPassword('correct password'));
    expect(await verifyPassword('correct password', hash)).toEqual({ success: true, method: 'scrypt' });
    expect(await verifyPassword('wrong password', hash)).toEqual({ success: false, method: null });
    expect(await verifyPassword('correct password', 'corrupt')).toEqual({ success: false, method: null });
  });
});
