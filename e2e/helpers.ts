/**
 * Shared Appium helpers. Interactive elements in the app have React Native `testID`s, which Android exposes as the
 * view's resource-id, so specs select by testID. Item rows use `item-<name>` (see src/components/ItemRow.tsx).
 */

export const APP_ID = 'com.tajveedaslam.sharecart'
const CAMERA_PERMISSION = 'android.permission.CAMERA'

export function byTestId(testID: string) {
  return $(`android=new UiSelector().resourceId("${testID}")`)
}

/** Same rule as itemTestId() in the app. */
export const itemId = (name: string) => `item-${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

/** Scrolls the current screen until the element is on screen, then returns it. */
export async function scrollTo(testID: string) {
  const el = byTestId(testID)
  if (!(await el.isDisplayed())) {
    await $(
      `android=new UiScrollable(new UiSelector().scrollable(true)).setMaxSearchSwipes(10).scrollIntoView(new UiSelector().resourceId("${testID}"))`,
    )
  }
  await el.waitForDisplayed()
  return el
}

export async function tap(testID: string) {
  const el = await scrollTo(testID)
  await el.click()
}

export async function type(testID: string, text: string) {
  const el = await scrollTo(testID)
  await el.clearValue()
  await el.setValue(text)
}

/** Visible text of an element; for a container, the text of every Text inside it joined by spaces. */
export async function textOf(testID: string): Promise<string> {
  const el = await scrollTo(testID)
  const own = await el.getText()
  if (own) return own.trim()
  const parts = await el.$$('android.widget.TextView').map((t) => t.getText())
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

export async function waitForTestId(testID: string, timeout = 30_000) {
  const el = byTestId(testID)
  await el.waitForDisplayed({ timeout })
  return el
}

export async function isChecked(testID: string): Promise<boolean> {
  return (await byTestId(testID).getAttribute('checked')) === 'true'
}

/** Taps a button in a native Android dialog by its label; `pattern` is a Java regex, e.g. "(?i)add again". */
export async function tapDialogButton(pattern: string) {
  const button = $(`android=new UiSelector().className("android.widget.Button").textMatches("${pattern}")`)
  await button.waitForDisplayed()
  await button.click()
}

/** Clean install state: no session, no lists in storage. Optionally pre-grants the camera. */
export async function resetApp({ grantCamera = false } = {}) {
  await driver.execute('mobile: terminateApp', { appId: APP_ID })
  await driver.execute('mobile: clearApp', { appId: APP_ID })
  if (grantCamera) {
    await driver.execute('mobile: changePermissions', { permissions: [CAMERA_PERMISSION], appPackage: APP_ID, action: 'grant' })
  }
  await driver.execute('mobile: activateApp', { appId: APP_ID })
}

export async function relaunchApp() {
  await driver.execute('mobile: terminateApp', { appId: APP_ID })
  await driver.execute('mobile: activateApp', { appId: APP_ID })
}

/** Signs in as a guest from the sign-in screen and waits for the lists screen. */
export async function signInAsGuest(name: string) {
  await waitForTestId('screen-sign-in', 45_000)
  await type('auth-name', name)
  await tap('auth-submit')
  await waitForTestId('screen-lists', 45_000)
}

/** Creates a list from the lists screen and waits for it to open. */
export async function createList(name: string) {
  await type('new-list-name', name)
  await tap('new-list-create')
  await waitForTestId('add-item-input', 30_000)
}

export async function addItem(text: string) {
  await type('add-item-input', text)
  await tap('add-item-submit')
}
