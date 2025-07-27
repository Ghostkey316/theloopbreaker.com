#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const signalLoop = require('./modules/signalLoop');
const sentimentEngine = require('./modules/sentimentEngine');
const heatGauge = require('./modules/heatGauge');
const responseLayer = require('./modules/responseLayer');
const loyaltySync = require('./modules/loyaltySync');

async function main() {
  const rawData = await signalLoop.fetchSignals();
  const analysis = sentimentEngine.analyze(rawData);
  heatGauge.display(analysis);
  if (analysis.globalIndex > (process.env.HOSTILITY_THRESHOLD || 70)) {
    const action = await responseLayer.recommend(rawData);
    console.log('Suggested Response:', action);
  }
  loyaltySync.update(rawData);
}

if (require.main === module) {
  main();
}
