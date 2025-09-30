#!/usr/bin/env node
'use strict';

function toBoolean(value, fallback = false) {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  return ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
}

const processEnv = typeof process !== 'undefined' && process && process.env ? process.env : {};
const mobileModeActive = toBoolean(processEnv.MOBILE_MODE, false);

function checkOptionalModule(name) {
  try {
    require.resolve(name);
    return true;
  } catch (error) {
    return false;
  }
}

const optionalModules = ['@sentry/react'];
const missing = optionalModules.filter((moduleName) => !checkOptionalModule(moduleName));

if (missing.length) {
  // eslint-disable-next-line no-console
  console.warn(
    `⚠ Optional module${missing.length > 1 ? 's' : ''} ${missing.join(', ')} not installed. Tests will use fallbacks. ` +
      'Install the dependency for full telemetry coverage.'
  );
} else {
  // eslint-disable-next-line no-console
  console.log('✅ Optional Sentry integrations detected.');
}

if (mobileModeActive) {
  // eslint-disable-next-line no-console
  console.log('✅ Mobile mode active: Skipping optional Sentry setup');
} else {
  // eslint-disable-next-line no-console
  console.log('ℹ Mobile mode disabled: full optional dependency checks will run as usual.');
}
