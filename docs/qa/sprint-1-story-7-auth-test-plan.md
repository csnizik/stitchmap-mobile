# QA Test Plan — Story 7: Firebase Email/Password Auth

Sprint 1 · Story 7. Covers registration, sign-in, sign-out, error handling, route
gating, and session persistence for the Firebase Auth flow.

## Preconditions

- A Firebase project on the Spark (free) tier with the **Email/Password** sign-in
  provider enabled.
- A local `.env` populated from `.env.example` with the project's
  `EXPO_PUBLIC_FIREBASE_*` values.
- App running via `npm run ios`, `npm run android`, and `npm run web`.
- At least one known-good test account (e.g. `qa@example.com`) created in advance for the
  sign-in cases, plus a fresh, unused email for the registration case.

## Platforms

Every scenario below is executed on **iOS**, **Android**, and **web**.

## Test Scenarios

### TC-1 — Successful registration

1. Launch the app signed out → the Login screen is shown.
2. Tap **Register**.
3. Enter a fresh email, a password (≥ 6 chars), and the same password in **Confirm
   password**.
4. Tap **Create account**.

**Expected:** account is created, the user is signed in automatically, and the app
redirects to the home screen showing "Signed in as <email>".

### TC-2 — Registration with mismatched passwords

1. On the Register screen, enter a fresh email and two **different** passwords.
2. Tap **Create account**.

**Expected:** inline error "Passwords do not match." is shown, no network call is made,
and the user stays on the Register screen.

### TC-3 — Registration with an already-used email

1. On the Register screen, enter the email of an existing account with matching
   passwords.
2. Tap **Create account**.

**Expected:** inline error "An account already exists for that email." is shown.

### TC-4 — Registration with a weak password

1. On the Register screen, enter a fresh email and a password shorter than 6 characters
   (matching confirm).
2. Tap **Create account**.

**Expected:** inline error "Password should be at least 6 characters." is shown.

### TC-5 — Successful sign-in

1. On the Login screen, enter the credentials of a known-good account.
2. Tap **Sign in**.

**Expected:** the user is signed in and redirected to the home screen.

### TC-6 — Sign-in with wrong password

1. On the Login screen, enter a valid email with an incorrect password.
2. Tap **Sign in**.

**Expected:** inline error "Incorrect email or password." is shown; the user stays on the
Login screen.

### TC-7 — Sign-in with an unregistered email

1. On the Login screen, enter an email that has no account.
2. Tap **Sign in**.

**Expected:** an inline error is shown ("Incorrect email or password." or "No account
found for that email.", depending on the project's email-enumeration protection setting);
the user stays on the Login screen.

### TC-8 — Network failure

1. Disable the device/emulator network connection.
2. Attempt to sign in (or register) with any credentials.

**Expected:** inline error "Network error. Check your connection and try again." is shown;
no crash; retrying after re-enabling the network succeeds.

### TC-9 — Sign-out

1. While signed in, on the home screen tap **Log out**.

**Expected:** the session ends and the app redirects to the Login screen. Pressing back
does not return to the protected home screen.

### TC-10 — Route gating

1. While signed out, attempt to navigate directly to `/` (web: type the URL; native: deep
   link `stitchmapmobile://`).
2. While signed in, attempt to navigate directly to `/login` or `/register`.

**Expected:** signed-out users are redirected to `/login`; signed-in users are redirected
to the home screen. Protected content is never shown while signed out.

### TC-11 — Session persistence across restart

1. Sign in successfully.
2. Fully close and relaunch the app (native), or refresh/reopen the tab (web).

**Expected:** the user remains signed in and lands on the home screen without
re-authenticating, confirming AsyncStorage persistence on native and default persistence
on web.

### TC-12 — Loading state

1. Cold-start the app while a previous session exists (throttle the network if needed to
   observe the transition).

**Expected:** no auth screen "flash" before the session resolves — the app renders the
correct destination once `isLoading` clears.

## Regression / Automated Coverage

The following unit tests run in CI (`npm run test`) and must stay green:

- `lib/firebase/__tests__/config.test.ts` — required-config validation.
- `lib/auth/__tests__/errors.test.ts` — Firebase error-code → message mapping.
- `lib/auth/__tests__/AuthProvider.test.tsx` — auth-state subscription and
  `signIn`/`signUp`/`signOut` behavior (including error surfacing).

## Sign-off

| Platform | Tester | Date | Result |
| -------- | ------ | ---- | ------ |
| iOS      |        |      |        |
| Android  |        |      |        |
| Web      |        |      |        |
