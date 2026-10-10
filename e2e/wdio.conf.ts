import path from 'node:path'
import process from 'node:process'
import { APP_ID } from './helpers.ts'

// The sharing spec signs a second user in from the test runner, so it needs the app's Supabase settings.
try {
  process.loadEnvFile(path.resolve(import.meta.dirname, '../.env'))
} catch {
  // No .env: specs that need Supabase from the runner skip themselves.
}

/**
 * Appium + WebdriverIO config for the ShareCart Android app (UiAutomator2).
 *
 * APP_PATH points at an .apk (`npx eas-cli build -p android --profile preview`); leave it unset to drive a copy
 * already installed on the device. UDID picks a device when several are connected (`adb devices`).
 */
const appPath = process.env.APP_PATH ? path.resolve(process.env.APP_PATH) : undefined

export const config: WebdriverIO.Config = {
  runner: 'local',
  tsConfigPath: './tsconfig.json',
  specs: ['./specs/**/*.e2e.ts'],
  maxInstances: 1,
  capabilities: [
    {
      platformName: 'Android',
      'appium:automationName': 'UiAutomator2',
      'appium:deviceName': process.env.DEVICE_NAME ?? 'Android device',
      ...(process.env.UDID && { 'appium:udid': process.env.UDID }),
      ...(appPath ? { 'appium:app': appPath } : { 'appium:appPackage': APP_ID, 'appium:appActivity': '.MainActivity' }),
      // Camera permission is granted per spec in resetApp(), so the "denied" path can be tested too.
      'appium:autoGrantPermissions': false,
      'appium:noReset': true,
      'appium:newCommandTimeout': 240,
    },
  ],
  logLevel: 'warn',
  waitforTimeout: 20_000,
  connectionRetryTimeout: 180_000,
  connectionRetryCount: 1,
  services: [['appium', { logPath: './logs' }]],
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: { ui: 'bdd', timeout: 180_000 },
}
