const fs = require('fs');
const path = require('path');

const DEFAULT_POLICY_PATH = path.join(__dirname, 'guardrail-policy.json');
const DEFAULT_LOG_PATH = path.join(process.cwd(), 'logs', 'ethics-guard.log');

const BASE_ETHICS_POLICY = Object.freeze({
  coreValues: Object.freeze({
    humanityOverGreed: true,
    freedomOverControl: true,
    noHumanOverAI: true,
    noAIOverHuman: true,
    privacyByDefault: true,
  }),
  blockedReasons: Object.freeze([]),
  warnReasons: Object.freeze(['excessive_automation']),
  automation: Object.freeze({
    windowMs: 60000,
    maxRequests: 30,
  }),
});

function mergeWithBasePolicy(candidate = {}) {
  const incoming = candidate && typeof candidate === 'object' ? candidate : {};

  const mergedCoreValues = { ...BASE_ETHICS_POLICY.coreValues };
  if (incoming.coreValues && typeof incoming.coreValues === 'object') {
    for (const [key, value] of Object.entries(incoming.coreValues)) {
      if (BASE_ETHICS_POLICY.coreValues[key] === true && value === false) {
        throw new Error(`Partner policy cannot disable base ethics value: ${key}`);
      }
      if (value === false) {
        throw new Error(`Partner policy cannot set ${key} to false. Core values may only be strengthened.`);
      }
      mergedCoreValues[key] = Boolean(value);
    }
  }

  const incomingBlocked = Array.isArray(incoming.blockedReasons) ? incoming.blockedReasons : [];
  const incomingWarn = Array.isArray(incoming.warnReasons) ? incoming.warnReasons : [];
  const blockedReasons = Array.from(new Set([...(BASE_ETHICS_POLICY.blockedReasons || []), ...incomingBlocked]));
  const warnReasons = Array.from(new Set([...(BASE_ETHICS_POLICY.warnReasons || []), ...incomingWarn]));

  const baseAutomation = BASE_ETHICS_POLICY.automation || {};
  const incomingAutomation = incoming.automation && typeof incoming.automation === 'object' ? incoming.automation : {};
  const automation = {
    windowMs:
      typeof incomingAutomation.windowMs === 'number'
        ? Math.min(incomingAutomation.windowMs, baseAutomation.windowMs || incomingAutomation.windowMs)
        : baseAutomation.windowMs,
    maxRequests:
      typeof incomingAutomation.maxRequests === 'number'
        ? Math.min(incomingAutomation.maxRequests, baseAutomation.maxRequests || incomingAutomation.maxRequests)
        : baseAutomation.maxRequests,
  };

  return {
    ...incoming,
    automation,
    blockedReasons,
    warnReasons,
    coreValues: Object.freeze(mergedCoreValues),
  };
}

function loadPolicy(customPath) {
  const filePath = customPath ? path.resolve(customPath) : DEFAULT_POLICY_PATH;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const partnerPolicy = JSON.parse(raw);
    return mergeWithBasePolicy(partnerPolicy);
  } catch (error) {
    throw new Error(`Unable to load Vaultfire ethics policy at ${filePath}: ${error.message}`);
  }
}

function ensureLogFile(logPath) {
  const dir = path.dirname(logPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(logPath)) {
    fs.writeFileSync(logPath, '', 'utf8');
  }
}

function createEthicsGuard({ policyPath, logPath } = {}) {
  const policy = loadPolicy(policyPath);
  const resolvedLogPath = logPath ? path.resolve(logPath) : DEFAULT_LOG_PATH;
  ensureLogFile(resolvedLogPath);

  const automationWindow = policy.automation?.windowMs || 60000;
  const automationMax = policy.automation?.maxRequests || 30;
  const automationCounters = new Map();

  function registerAutomation(userKey) {
    const now = Date.now();
    const entry = automationCounters.get(userKey) || { count: 0, windowStart: now };
    if (now - entry.windowStart > automationWindow) {
      entry.count = 0;
      entry.windowStart = now;
    }
    entry.count += 1;
    automationCounters.set(userKey, entry);
    return entry.count;
  }

  const guard = function ethicsGuard(req, res, next) {
    const reasonFlag = (req.headers['x-vaultfire-reason'] || req.body?.reasonFlag || '').toLowerCase();
    const purpose = req.headers['x-vaultfire-purpose'] || req.body?.purpose || null;
    const userType = req.user?.role || 'anonymous';
    const endpoint = req.originalUrl || req.url;
    const correlationId = req.headers['x-correlation-id'] || null;

    let decision = 'allowed';
    let decisionReason = null;
    if (reasonFlag && policy.blockedReasons?.includes(reasonFlag)) {
      decision = 'blocked';
      decisionReason = 'blocked_reason_policy';
    } else if (reasonFlag && policy.warnReasons?.includes(reasonFlag)) {
      decision = 'warned';
      decisionReason = 'warn_threshold';
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      userType,
      endpoint,
      method: req.method,
      reasonFlag: reasonFlag || null,
      purpose: purpose || null,
      correlationId,
      decision,
      decisionReason,
      enforcedCoreValues: policy.coreValues,
    };

    fs.appendFileSync(resolvedLogPath, `${JSON.stringify(logEntry)}\n`);

    if (reasonFlag && policy.blockedReasons?.includes(reasonFlag)) {
      return res.status(451).json({
        error: {
          code: 'ethics.blocked_intent',
          message: `The requested action conflicts with the Vaultfire ethics-first guardrails (${reasonFlag}).`,
        },
      });
    }

    if (reasonFlag && policy.warnReasons?.includes(reasonFlag)) {
      const identityKey = `${userType}:${req.user?.sub || req.ip}`;
      const currentCount = registerAutomation(identityKey);
      res.setHeader('X-Vaultfire-Ethics-Warning', reasonFlag);
      if (currentCount > automationMax) {
        return res.status(429).json({
          error: {
            code: 'ethics.automation_exceeded',
            message: 'Automation activity exceeded agreed partner thresholds.',
          },
        });
      }
    }

    return next();
  };
  guard.policy = policy;
  guard.basePolicy = BASE_ETHICS_POLICY;
  return guard;
}

module.exports = Object.assign(createEthicsGuard, {
  BASE_ETHICS_POLICY,
  mergeWithBasePolicy,
});
