import * as crypto from 'crypto';

let bcryptLib: any;

try {
  bcryptLib = require('bcrypt');
  if (typeof bcryptLib.compareSync !== 'function') throw new Error('missing native binding');
} catch (e) {
  try {
    const bcryptjs = require('bcryptjs');
    bcryptLib = {
      compare: async (plain: string, hashed: string) => {
        if (!hashed) return false;
        const normalized = hashed.startsWith('$2b$') ? hashed.replace(/^\$2b\$/, '$2a$') : hashed;
        try {
          return bcryptjs.compareSync(plain, normalized);
        } catch {
          return false;
        }
      },
      compareSync: (plain: string, hashed: string) => {
        if (!hashed) return false;
        const normalized = hashed.startsWith('$2b$') ? hashed.replace(/^\$2b\$/, '$2a$') : hashed;
        try {
          return bcryptjs.compareSync(plain, normalized);
        } catch {
          return false;
        }
      },
      hash: async (plain: string, rounds?: number) => {
        return bcryptjs.hashSync(plain, rounds || 10);
      },
      hashSync: (plain: string, rounds?: number) => {
        return bcryptjs.hashSync(plain, rounds || 10);
      },
    };
  } catch {
    bcryptLib = {
      compare: async (plain: string, hashed: string) => {
        if (!hashed) return false;
        const parts = hashed.split(':');
        if (parts.length === 2) {
          const [salt, key] = parts;
          const derived = crypto.scryptSync(plain, salt, 64).toString('hex');
          return derived === key;
        }
        return plain === hashed;
      },
      hash: async (plain: string, rounds?: number) => {
        const salt = crypto.randomBytes(16).toString('hex');
        const derived = crypto.scryptSync(plain, salt, 64).toString('hex');
        return `${salt}:${derived}`;
      },
    };
  }
}

export const bcrypt = bcryptLib;
