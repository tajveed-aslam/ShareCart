import { byTestId, itemId, relaunchApp, resetApp, signInAsGuest, tap, tapDialogButton, textOf, type, waitForTestId } from '../helpers.ts'

describe('Signing in', () => {
  before(async () => {
    await resetApp()
  })

  it('needs a name before continuing as a guest', async () => {
    await waitForTestId('screen-sign-in', 45_000)
    expect(await byTestId('auth-submit').getAttribute('enabled')).toBe('false')
  })

  it('validates email and password on the sign-in tab', async () => {
    await tap('auth-tab-sign-in')
    await type('auth-email', 'not-an-email')
    await type('auth-password', '123')
    expect(await byTestId('auth-submit').getAttribute('enabled')).toBe('false')
    await tap('auth-tab-guest')
  })

  it('continues as a guest and starts with a sample list', async () => {
    await signInAsGuest('Appium Guest')
    await waitForTestId('list-row-Weekly shop', 30_000)
    expect(await textOf('list-row-Weekly shop')).toMatch(/5 of 5 to buy/)
  })

  it('shows the sample items and who added them', async () => {
    await tap('list-row-Weekly shop')
    await waitForTestId(itemId('Milk'))
    expect(await textOf(`${itemId('Milk')}-added-by`)).toMatch(/^Added by You/)
    await driver.back()
  })

  it('keeps the session across app restarts', async () => {
    await relaunchApp()
    await waitForTestId('screen-lists', 45_000)
  })

  it('shows the guest warning and signs out after confirming', async () => {
    await tap('open-account')
    expect(await textOf('account-kind')).toMatch(/Guest/)
    await waitForTestId('guest-warning')
    await tap('sign-out')
    await tapDialogButton('(?i)sign out')
    await waitForTestId('screen-sign-in', 30_000)
  })
})
