const fs = require('fs');
const path = require('path');

const DEFAULT_POLICY_PATH = path.join(__dirname, 'guardrail-policy.json');
const DEFAULT_LOG_PATH = path.join(process.cwd(), 'logs', 'ethics-guard.log');

function loadPolicy(customPath) {
  const filePath = customPath ? path.resolve(customPath) : DEFAULT_POLICY_PATH;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
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

  return function ethicsGuard(req, res, next) {
    const reasonFlag = (req.headers['x-vaultfire-reason'] || req.body?.reasonFlag || '').toLowerCase();
    const userType = req.user?.role || 'anonymous';
    const endpoint = req.originalUrl || req.url;
    const correlationId = req.headers['x-correlation-id'] || null;

    const logEntry = {
      timestamp: new Date().toISOString(),
      userType,
      endpoint,
      method: req.method,
      reasonFlag: reasonFlag || null,
      correlationId,
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
}

module.exports = createEthicsGuard;
