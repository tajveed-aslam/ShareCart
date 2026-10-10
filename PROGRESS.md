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
- Supabase project `pcyygcltdylmicfbaqbi` (Frankfurt) is set up by the owner: migration run, anonymous sign-ins on.
  URL + publishable key in `.env` (gitignored).
- Integration suite `tests/integration/sharecart.test.mts` (node:test, 3 anonymous users): **12/12 passing**, three
  runs in a row; realtime delivery 0.7–2 s.
- **Live on Vercel: https://sharecart-omega.vercel.app/** (auto-deploys from `main`, so WIP goes on a branch). Env
  vars EXPO_PUBLIC_SUPABASE_URL / _PUBLISHABLE_KEY set in Vercel. The two-browser check passes 16/16 against it.
- Portfolio entry added with `featured: false` (owner: FitCheck stays the lead featured project).
- Two-browser Playwright check of the web build (scratchpad `ui-e2e/sharecart.mjs`): 16/16 steps, no console
  errors: guest sign-in with sample list, invite link while signed out → preview → join, live member join,
  presence, add/check/edit/delete crossing over, Open Food Facts lookup, duplicate barcode, live home counts,
  bad codes, list deletion seen by the other member.
- Appium suite in `e2e/` (4 specs), typechecks. Running it is on hold (owner, 2026-10-08: no JDK/Android SDK setup).

## In progress
- Nothing mid-edit.

## Next steps
1. (On hold) EAS APK and running the Appium suite.

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
- Realtime is "ready" on the channel's `system` message (extension postgres_changes, status ok), not on SUBSCRIBED;
  the app refetches at that point and the tests wait for it. A fresh project's first subscription can take seconds.
- Don't use expo-router `<Link asChild>` around a Pressable with array styles: on web it put a style array on the
  DOM node and crashed the list screen. Navigation uses Pressable + router.push.
- New guests: AuthProvider holds the session back (holdSession ref) until the sample list is seeded, so the home
  screen never shows it half-filled.
- Supabase limits anonymous sign-ins to 30/hour per IP; repeated test runs hit HTTP 429.
- Expo bakes EXPO_PUBLIC_* vars in at bundle time; after changing .env use `npx expo export --clear`.
