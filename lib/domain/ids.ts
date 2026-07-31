/**
 * Opaque identifiers for line and point stitches.
 *
 * Ids are opaque by design: nothing parses them, and imported patterns may
 * carry ids from other tools. Validation only requires a non-empty string.
 *
 * These are not security tokens. They only need to be unique within a single
 * pattern, so a 12-character base-36 value (about 62 bits) is ample.
 */

import type { StitchId } from './types';

const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const ID_LENGTH = 12;

/** Injectable so tests can be deterministic. */
export type RandomSource = () => number;

export function createStitchId(random: RandomSource = Math.random): StitchId {
  let out = '';
  for (let i = 0; i < ID_LENGTH; i += 1) {
    const index = Math.floor(random() * ID_ALPHABET.length);
    // Guard against a random source returning exactly 1.
    const safe = index >= ID_ALPHABET.length ? ID_ALPHABET.length - 1 : index;
    out += ID_ALPHABET.charAt(safe);
  }
  return out;
}

/** A valid id is any non-empty string. */
export function isStitchId(value: unknown): value is StitchId {
  return typeof value === 'string' && value.length > 0;
}
