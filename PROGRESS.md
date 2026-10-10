# Progress — ShareCart
_Last updated: 2026-10-10 by Claude Code_

## Goal
Shared family grocery lists: React Native (Expo, TS) + Supabase (auth, Postgres, realtime). Create lists, add items
by typing or barcode scan, share with family and sync live, show who added/checked each item. Web build on Vercel as
the portfolio live demo.

## Done
- Expo SDK 57 + Expo Router (routes in `src/app/`), Supabase client (AsyncStorage sessions on native, AppState
  token refresh), expo-camera barcode scanning, light/dark theme.
- Database (`supabase/migrations/20261010000000_init.sql`): profiles (auto-created from sign-up name), lists,
  list_members, items; RLS on everything; triggers stamping added_by/checked_by/checked_at and protecting
  owner_id/invite_code; RPCs invite_preview / join_list / regenerate_invite_code; realtime publication.
- Screens: sign-in (guest / email), lists, live list (optimistic edits, presence, offline banner), scanner (Open Food
  Facts lookup, check-digit validation, duplicate warning, manual entry), share (code, link, members, rename,
  leave/delete), join (works signed out), account.
- 41 Jest unit tests (`npm test`); typecheck + `expo lint` clean; web export builds.
- Integration suite `tests/integration/sharecart.test.mts` (node:test, 3 anonymous users): **written, not yet run**
  — needs the Supabase project.
- Appium suite in `e2e/` (4 specs), typechecks. Running it is on hold (owner, 2026-10-08: no JDK/Android SDK setup).

## In progress
- Waiting on the owner to create the Supabase project (see README "Set up Supabase").

## Next steps
1. Owner: create Supabase project, run the migration SQL, enable anonymous sign-ins (and turn off Confirm email),
   put URL + publishable key in `.env`.
2. Run `npm run test:integration`; fix anything it finds. Check two browsers syncing via Playwright on the web build.
3. Owner deploys to Vercel with the two EXPO_PUBLIC_ env vars; then push WIP to a branch, not `main`.
4. Portfolio entry (screenshots from the deployed app, two-user realtime shot) + About mention.

## Decisions & gotchas
- **Expo Router**, per the template's AGENTS.md (the spec didn't name a navigator; SalahCompanion used React
  Navigation only because its spec said so). Expo Router 57 re-exports ThemeProvider/DarkTheme/DefaultTheme.
- Sessions: AsyncStorage on native, supabase-js default (localStorage) on web. Not the quickstart's expo-sqlite
  localStorage polyfill, which complicates the web build.
- `lists` SELECT policy includes `owner_id = auth.uid()`: INSERT…RETURNING is checked before the trigger that adds
  the owner's membership row runs.
- Realtime DELETE payloads under RLS carry only the primary key, so DELETE subscriptions are unfiltered and matched
  by id client-side (`applyItemChange`).
- Presence needs a shared topic `list:<id>`, and a client can hold one channel per topic: the share screen uses
  `useList(..., { presence: false })`, which subscribes on a uniquely named channel.
- Optimistic drafts use `updated_at = epoch` so the server row always wins regardless of device clock skew.
- React Compiler lint forbids setState called synchronously in effects: initial loads go through an async IIFE.
- Node runs the integration test as `.mts` (native TS type stripping, ESM).
