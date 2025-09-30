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

if (mobileModeActive) {
  // eslint-disable-next-line no-console
  console.log('✅ Mobile mode active: Skipping optional Sentry setup');
} else {
  // eslint-disable-next-line no-console
  console.log('ℹ Mobile mode disabled: full optional dependency checks will run as usual.');
}
