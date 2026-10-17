import { describe, it, expect } from 'vitest';
import { SignupDtoSchema, TrackWalletDtoSchema, TokenQueryDtoSchema } from '../index.js';

describe('Shared Zod Boundary Validation', () => {
  it('validates signup payload requiring 8+ character password', () => {
    expect(() =>
      SignupDtoSchema.parse({
        email: 'invalid-email',
        password: 'short',
      })
    ).toThrow();

    const valid = SignupDtoSchema.parse({
      email: 'trader@solradar.io',
      password: 'strongpassword123',
    });
    expect(valid.email).toBe('trader@solradar.io');
  });

  it('validates Solana wallet addresses on track commands', () => {
    // Valid base58 32-44 chars
    const valid = TrackWalletDtoSchema.parse({
      address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      label: 'Whale 1',
    });
    expect(valid.address).toBe('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU');

    // Too short
    expect(() =>
      TrackWalletDtoSchema.parse({
        address: 'short_address',
      })
    ).toThrow();
  });

  it('parses and defaults token query parameters safely', () => {
    const query = TokenQueryDtoSchema.parse({
      minMcap: '10000',
      limit: '25',
    });
    expect(query.minMcap).toBe(10000);
    expect(query.limit).toBe(25);
    expect(query.sortBy).toBe('volume_5m');
    expect(query.stage).toBe('all');
  });
});
