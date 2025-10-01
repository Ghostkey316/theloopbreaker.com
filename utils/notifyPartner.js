const alertCenter = require('../services/partner-alerts/alertCenter');

async function notifyPartner(event) {
  return alertCenter.record(event);
}

function registerPartnerWebhook(config) {
  return alertCenter.registerWebhook(config);
}

function getPartnerStatus() {
  return alertCenter.getStatus();
}

function getRecentAlerts(limit) {
  return alertCenter.getRecentAlerts(limit);
}

module.exports = {
  notifyPartner,
  registerPartnerWebhook,
  getPartnerStatus,
  getRecentAlerts,
};
