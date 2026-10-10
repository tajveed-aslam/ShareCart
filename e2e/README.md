# ShareCart — Appium E2E tests

End-to-end tests for the Android app in TypeScript with **WebdriverIO 10 + Appium 3 (UiAutomator2)**. Elements are
found by React Native `testID` (Android `resource-id`); item rows are `item-<name>`, e.g. `item-milk-check`.

| Spec | Covers |
|---|---|
| `auth.e2e.ts` | Guest sign-in validation, sample list, session kept across restarts, guest sign-out warning |
| `items.e2e.ts` | Typed items with quantities, duplicate warning, check/uncheck with "Got by", edit, persistence, delete, clear cart |
| `scan.e2e.ts` | Camera permission prompt, check-digit rejection, Open Food Facts lookup, duplicate barcode, naming unknown products |
| `sharing.e2e.ts` | Real-time sync with a second member ("Sam") driven from the test runner via supabase-js: join by code, Sam's add / check / delete / rename appear live on the phone, the phone's check-off reaches Sam |

The camera can't be aimed at a product from a test, so scanning is driven through the manual barcode field, which
uses the same validation, lookup and add path as a camera read.

## Setup and run

Same one-time setup as SalahCompanion's suite: JDK 17, Android platform-tools (`adb`), a phone with USB debugging
(or an emulator), then in this folder `npm install` and `npm run appium:driver`.

The sharing spec reads the app's `../.env` for the Supabase URL and publishable key (anonymous sign-ins must be on).

```powershell
$env:APP_PATH = "C:\path\to\sharecart.apk"   # from: npx eas-cli build -p android --profile preview
npm test
npm run test:spec -- ./specs/sharing.e2e.ts
```
