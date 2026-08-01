/**
 * Security rules tests. These run against the local Firestore emulator, not a
 * real project, so they cost nothing and need no network.
 *
 *   npm run test:rules
 *
 * The emulator loads `firestore.rules` itself via `firebase.json`, so this file
 * only connects. That deliberately avoids reading the rules file from disk,
 * because tsconfig sets `"types": ["jest"]` and so excludes the node types.
 *
 * Kept out of `npm test` so CI stays green without an emulator. Case list is
 * ADR-005 section 6.
 */

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

/**
 * A `demo-` prefixed project id runs the emulator fully offline with no
 * credentials and no real Firebase project. Must match the `--project` flag in
 * the `test:rules` script.
 */
const PROJECT_ID = 'demo-stitchmap';

const OWNER = 'user-owner';
const OTHER = 'user-other';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host: '127.0.0.1', port: 8080 },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe('unauthenticated access', () => {
  it('cannot read a user document', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, `users/${OWNER}/patterns/p1`)));
  });

  it('cannot write a user document', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(db, `users/${OWNER}/patterns/p1`), { name: 'nope' }));
  });
});

describe('owner access', () => {
  it('can write and read its own pattern', async () => {
    const db = testEnv.authenticatedContext(OWNER).firestore();
    await assertSucceeds(setDoc(doc(db, `users/${OWNER}/patterns/p1`), { name: 'mine' }));
    await assertSucceeds(getDoc(doc(db, `users/${OWNER}/patterns/p1`)));
  });

  it('can write and read its own project', async () => {
    const db = testEnv.authenticatedContext(OWNER).firestore();
    await assertSucceeds(setDoc(doc(db, `users/${OWNER}/projects/j1`), { patternId: 'p1' }));
    await assertSucceeds(getDoc(doc(db, `users/${OWNER}/projects/j1`)));
  });

  it('reaches chunk subcollections through the recursive wildcard', async () => {
    const db = testEnv.authenticatedContext(OWNER).firestore();
    await assertSucceeds(
      setDoc(doc(db, `users/${OWNER}/patterns/p1/chunks/0000`), { index: 0, data: '[]' }),
    );
    await assertSucceeds(getDoc(doc(db, `users/${OWNER}/patterns/p1/chunks/0000`)));
    await assertSucceeds(
      setDoc(doc(db, `users/${OWNER}/patterns/p1/lineChunks/0000`), { index: 0, data: '[]' }),
    );
    await assertSucceeds(
      setDoc(doc(db, `users/${OWNER}/projects/j1/chunks/0000`), { index: 0, data: '[]' }),
    );
  });
});

describe('cross user access', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, `users/${OWNER}/patterns/p1`), { name: 'private' });
      await setDoc(doc(db, `users/${OWNER}/patterns/p1/chunks/0000`), { index: 0, data: '[]' });
    });
  });

  it('cannot read another user pattern', async () => {
    const db = testEnv.authenticatedContext(OTHER).firestore();
    await assertFails(getDoc(doc(db, `users/${OWNER}/patterns/p1`)));
  });

  it('cannot write another user pattern', async () => {
    const db = testEnv.authenticatedContext(OTHER).firestore();
    await assertFails(setDoc(doc(db, `users/${OWNER}/patterns/p1`), { name: 'hijacked' }));
  });

  it('cannot reach another user chunks', async () => {
    const db = testEnv.authenticatedContext(OTHER).firestore();
    await assertFails(getDoc(doc(db, `users/${OWNER}/patterns/p1/chunks/0000`)));
  });
});

describe('paths outside users/', () => {
  it('are denied even when signed in', async () => {
    const db = testEnv.authenticatedContext(OWNER).firestore();
    await assertFails(getDoc(doc(db, 'patterns/p1')));
    await assertFails(setDoc(doc(db, 'anything/else'), { a: 1 }));
  });
});
