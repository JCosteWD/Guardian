// ══════════════════════════════════════════════════════════════════════════════
// GUARDIAN – Configuration complète des tests
// ══════════════════════════════════════════════════════════════════════════════

// ── e2e/jest.config.js ────────────────────────────────────────────────────────
const jestE2EConfig = {
  testEnvironment:       'node',
  testRunner:            'jest-circus/runner',
  testTimeout:           120000,
  rootDir:               '../',
  testMatch:             ['<rootDir>/e2e-tests/**/*.e2e.js'],
  globalSetup:           'detox/runners/jest/globalSetup',
  globalTeardown:        'detox/runners/jest/globalTeardown',
  reporters:             ['detox/runners/jest/reporter'],
  verbose:               true,
  maxWorkers:            1,
  setupFilesAfterEach:   ['<rootDir>/e2e-tests/setup.js'],
};

// ── e2e/setup.js ──────────────────────────────────────────────────────────────
const e2eSetup = `
const { device } = require('detox');
beforeAll(async () => {
  await device.launchApp({ newInstance: true });
});
afterAll(async () => {
  await device.terminateApp();
});
afterEach(async () => {
  if (device.getPlatform() === 'android') {
    await device.reverseTcpPort(8081);
  }
});
`;

// ── .detoxrc.js ───────────────────────────────────────────────────────────────
const detoxConfig = {
  testRunner: {
    $0: 'jest',
    args: { config: 'e2e-tests/jest.config.js', _: ['e2e-tests'] },
  },
  apps: {
    'android.debug.parent': {
      type: 'android.apk',
      binaryPath: 'mobile-parent/android/app/build/outputs/apk/debug/app-debug.apk',
      build: 'cd mobile-parent/android && ./gradlew assembleDebug',
    },
    'android.debug.child': {
      type: 'android.apk',
      binaryPath: 'mobile-child/android/app/build/outputs/apk/debug/app-debug.apk',
      build: 'cd mobile-child/android && ./gradlew assembleDebug',
    },
    'android.release.parent': {
      type: 'android.apk',
      binaryPath: 'mobile-parent/android/app/build/outputs/apk/release/app-release.apk',
      build: 'cd mobile-parent/android && ./gradlew assembleRelease',
    },
  },
  devices: {
    emulator: {
      type: 'android.emulator',
      device: { avdName: 'Pixel_6_API_33' },
    },
    attached: {
      type: 'android.attached',
      device: { adbName: '.*' },
    },
  },
  configurations: {
    'android.emu.debug.parent': {
      device: 'emulator',
      app: 'android.debug.parent',
    },
    'android.emu.debug.child': {
      device: 'emulator',
      app: 'android.debug.child',
    },
    'android.emu.release': {
      device: 'emulator',
      app: 'android.release.parent',
    },
    'android.device.debug': {
      device: 'attached',
      app: 'android.debug.parent',
    },
  },
};

// ── backend/package.json (scripts section) ────────────────────────────────────
const backendScripts = {
  "start":           "node src/server.js",
  "dev":             "nodemon src/server.js",
  "migrate":         "node src/config/migrate.js",
  "migrate:v3":      "node backend-extra/migrateV3.js",
  "migrate:v6":      "node complete-tests/migrateV6.js",
  "migrate:all":     "npm run migrate && npm run migrate:v3 && npm run migrate:v6",
  "test":            "jest --coverage --forceExit",
  "test:watch":      "jest --watch",
  "test:complete":   "jest --config complete-tests/jest.complete.js --coverage --forceExit",
  "lint":            "eslint src/ --ext .js",
  "seed":            "node src/config/seed.js",
};

// ── backend/jest.config.js ────────────────────────────────────────────────────
const jestBackendConfig = {
  testEnvironment:    'node',
  testMatch:          ['**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    'backend-extra/**/*.js',
    'profile/**/*.js',
    '!src/config/migrate*.js',
    '!**/node_modules/**',
  ],
  coverageThresholds: {
    global: { branches: 60, functions: 70, lines: 70, statements: 70 },
  },
  setupFilesAfterFramework: [],
  testTimeout: 30000,
};

// ── mobile-parent/package.json (scripts) ─────────────────────────────────────
const mobileParentScripts = {
  "android":          "react-native run-android",
  "start":            "react-native start",
  "build:debug":      "cd android && ./gradlew assembleDebug",
  "build:release":    "cd android && ./gradlew assembleRelease",
  "build:bundle":     "cd android && ./gradlew bundleRelease",
  "test:e2e":         "detox test --configuration android.emu.debug.parent",
  "test:e2e:release": "detox test --configuration android.emu.release",
  "lint":             "eslint src/ --ext .js,.jsx",
  "clean":            "cd android && ./gradlew clean",
};

// ══════════════════════════════════════════════════════════════════════════════
// Écrit les fichiers de config
// ══════════════════════════════════════════════════════════════════════════════
const fs   = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../..');

// e2e/jest.config.js
fs.mkdirSync(path.join(rootDir, 'e2e-tests'), { recursive: true });
fs.writeFileSync(
  path.join(rootDir, 'e2e-tests/jest.config.js'),
  `module.exports = ${JSON.stringify(jestE2EConfig, null, 2)}\n`
);

// e2e/setup.js
fs.writeFileSync(path.join(rootDir, 'e2e-tests/setup.js'), e2eSetup.trim() + '\n');

// .detoxrc.js
fs.writeFileSync(
  path.join(rootDir, '.detoxrc.js'),
  `module.exports = ${JSON.stringify(detoxConfig, null, 2)}\n`
);

// backend/jest.config.js
fs.writeFileSync(
  path.join(rootDir, 'backend/jest.config.js'),
  `module.exports = ${JSON.stringify(jestBackendConfig, null, 2)}\n`
);

console.log('✅ Fichiers de configuration tests générés');
console.log('  → e2e-tests/jest.config.js');
console.log('  → e2e-tests/setup.js');
console.log('  → .detoxrc.js');
console.log('  → backend/jest.config.js');
console.log('\nScripts backend recommandés (package.json):');
console.log(JSON.stringify(backendScripts, null, 2));
console.log('\nScripts mobile-parent recommandés:');
console.log(JSON.stringify(mobileParentScripts, null, 2));

module.exports = { jestE2EConfig, detoxConfig, jestBackendConfig };
