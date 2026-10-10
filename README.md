# ShareCart

A shared grocery list for families, built with React Native (Expo, TypeScript) and Supabase. Make a list, invite
the family with a code or link, and everyone's changes show up on everyone's phone instantly: who added each item,
who put it in the cart, and who's looking at the list right now. Add items by typing ("2 milk") or by scanning a
barcode with the camera.

**Live demo (web): https://sharecart-omega.vercel.app/** — continue as a guest, open Share, and open the invite link
in a private window to watch two people edit the same list in real time.

| | |
|---|---|
| **Lists** | Create, rename and delete lists; item counts on the home screen update live. |
| **Sharing** | Every list has an 8-character invite code (no look-alike characters) and a `/join/<code>` link. The join screen previews the list and its owner first. Owners can remove people and reset the code; members can leave. |
| **Real-time sync** | One Supabase Realtime channel per open list: row changes for items, the list and its members (filtered by RLS, so only members receive them) plus presence avatars for who has it open. Edits are optimistic and reconciled by id and `updated_at`; the list is refetched after every reconnect. |
| **Who did what** | "Added by Ayesha · 5m ago", "Got by You · just now". Database triggers stamp `added_by` / `checked_by` from the caller's JWT, so a client can't claim someone else did it. |
| **Barcode scanning** | `expo-camera` reads EAN-13/8, UPC-A/E and Code 128. Reads that fail the GS1 check digit are ignored (no misread lookups), the product name comes from [Open Food Facts](https://world.openfoodfacts.org), duplicates on the list are flagged, and unknown products can be named by hand. A manual barcode field covers devices without a camera. |
| **Accounts** | Email + password, or "continue as guest" (Supabase anonymous sign-in) with a display name; guests start with a sample list. |

## Stack

Expo SDK 57 · React Native 0.86 · TypeScript · Expo Router · Supabase (Auth, Postgres with Row Level Security,
Realtime) · expo-camera · Open Food Facts API · Jest · node:test integration tests · Appium (WebdriverIO).

## Set up Supabase (once)

1. Create a project at [supabase.com](https://supabase.com) (region: Frankfurt / eu-central-1).
2. **SQL Editor → New query**: paste all of [`supabase/migrations/20261010000000_init.sql`](supabase/migrations/20261010000000_init.sql) and run it.
3. **Authentication → Sign In / Providers**: turn on **Allow anonymous sign-ins** (guest mode). For a demo, also
   turn off **Confirm email** so email sign-ups can sign in straight away.
4. **Project Settings → API Keys**: copy the project URL and the **publishable** key into `.env`:
   ```bash
   cp .env.example .env    # then edit the two values
   ```
   The publishable key is meant to ship in the app; Row Level Security is what protects the data. Never use the
   secret/service-role key here.

## Run it

```bash
npm install
npx expo start      # scan the QR code with Expo Go (Android/iOS), or press w for the web
```

The camera, haptics and everything else work in Expo Go. In a desktop browser, use the manual barcode field.

## Test

```bash
npm test                    # 41 Jest unit tests: realtime reducer, sorting, duplicates, quantity parsing, barcodes, invites
npm run test:integration    # against your Supabase project: RLS, spoof-proof triggers, invite RPCs, realtime (3 users)
npm run typecheck
npm run lint
```

End-to-end tests with Appium are in [`e2e/`](e2e/README.md).

Each run signs in a few guest users. Supabase allows 30 anonymous sign-ins per hour per IP by default, so running
the suites many times in a row returns HTTP 429; wait, or raise the limit under Authentication → Rate Limits.

## Deploy the web version (Vercel)

Import the repo in Vercel and add two environment variables, `EXPO_PUBLIC_SUPABASE_URL` and
`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (they're baked into the build). `vercel.json` sets the build command,
output folder and SPA rewrites, so `/join/<code>` links work.

## Project layout

```
src/
  app/                    Expo Router screens
    _layout.tsx           providers, auth-guarded stack (Stack.Protected)
    sign-in.tsx           guest / sign in / create account
    index.tsx             your lists, create a list, join with a code
    list/[id]/index.tsx   the live list
    list/[id]/scan.tsx    barcode scanner (modal)
    list/[id]/share.tsx   invite code, members, rename/leave/delete (modal)
    join/[code].tsx       invite preview + join (works signed out too)
    account.tsx           display name, sign out
  auth/AuthProvider.tsx   session, profile, sign-in methods
  data/                   useLists, useList (realtime + presence), mutations
  lib/                    pure logic: items reducer, barcode + Open Food Facts, invite codes, formatting
  components/             UI kit, item row, item editor, auth form
supabase/migrations/      schema, RLS policies, triggers, RPCs, realtime publication
tests/integration/        node:test suite against a real Supabase project
e2e/                      Appium suite (separate package)
```
