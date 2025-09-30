#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

function detectMobileGitHubApp(env = process.env) {
  const userAgent = (env.GITHUB_USER_AGENT || env.GIT_USER_AGENT || '').toLowerCase();
  if (userAgent.includes('githubmobile') || userAgent.includes('github-ios')) {
    return true;
  }
  const mobileHints = [
    env.GITHUB_MOBILE,
    env.GITHUB_APP_DEVICE,
    env.MOBILE_GITHUB,
    env.MOBILE_DEVICE,
    env.TERMUX_VERSION,
    env.ANDROID_ROOT,
  ];
  if (mobileHints.some((value) => typeof value === 'string' && /mobile|ios|android/.test(value.toLowerCase()))) {
    return true;
  }
  if ((env.SSH_CONNECTION || '').includes('mobile')) {
    return true;
  }
  return false;
}

function getRepoSlug() {
  try {
    const url = execSync('git config --get remote.origin.url', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    if (!url) return null;
    const sshMatch = url.match(/github.com[:/](.+?)(\.git)?$/i);
    return sshMatch ? sshMatch[1].replace(/\.git$/, '') : null;
  } catch (error) {
    return null;
  }
}

function getCurrentBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch (error) {
    return null;
  }
}

function getDefaultBranch() {
  try {
    const ref = execSync('git symbolic-ref refs/remotes/origin/HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
    if (!ref) return 'main';
    const parts = ref.split('/');
    return parts[parts.length - 1] || 'main';
  } catch (error) {
    return 'main';
  }
}

function getLastCommit() {
  try {
    const subject = execSync('git log -1 --pretty=%s', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    const body = execSync('git log -1 --pretty=%b', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    return { subject, body };
  } catch (error) {
    return { subject: 'Vaultfire Protocol Update', body: '' };
  }
}

function buildPrefilledPrUrl({ repo, base, head, title, body }) {
  if (!repo || !head) {
    return null;
  }
  const params = new URLSearchParams({
    quick_pull: '1',
    title: title || '',
    body: body || '',
  });
  return `https://github.com/${repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}?${params.toString()}`;
}

function writeState(state) {
  const filePath = path.join(process.cwd(), '.git', 'vaultfire-mobile-pr.json');
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
  return filePath;
}

function readState() {
  const filePath = path.join(process.cwd(), '.git', 'vaultfire-mobile-pr.json');
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return null;
  }
}

function openUrl(url) {
  const candidates = ['termux-open-url', 'xdg-open', 'open'];
  for (const command of candidates) {
    const result = spawnSync(command, [url], { stdio: 'ignore' });
    if (result.status === 0) {
      return true;
    }
  }
  return false;
}

function prepare() {
  if (!detectMobileGitHubApp()) {
    return;
  }
  const repo = getRepoSlug();
  const head = getCurrentBranch();
  if (!repo || !head) {
    return;
  }
  const base = getDefaultBranch();
  const commit = getLastCommit();
  const url = buildPrefilledPrUrl({
    repo,
    base,
    head,
    title: commit.subject,
    body: commit.body,
  });
  const state = {
    generatedAt: new Date().toISOString(),
    repo,
    base,
    head,
    title: commit.subject,
    body: commit.body,
    url,
  };
  writeState(state);
  // eslint-disable-next-line no-console
  console.log('📱 GitHub mobile context detected. Prefilled PR link prepared for fallback.');
  // eslint-disable-next-line no-console
  console.log(`➡️  ${url}`);
}

function redirect() {
  if (!detectMobileGitHubApp()) {
    return;
  }
  const state = readState();
  if (!state || !state.url) {
    // eslint-disable-next-line no-console
    console.warn('No mobile PR metadata available. Run with --prepare before pushing.');
    return;
  }
  const opened = openUrl(state.url);
  if (!opened) {
    // eslint-disable-next-line no-console
    console.warn('Unable to launch browser automatically. Open this URL manually:');
    // eslint-disable-next-line no-console
    console.warn(state.url);
  } else {
    // eslint-disable-next-line no-console
    console.log('Redirected to mobile PR creation flow.');
  }
}

(function main() {
  const args = process.argv.slice(2);
  if (args.includes('--redirect')) {
    redirect();
  } else {
    prepare();
  }
})();
