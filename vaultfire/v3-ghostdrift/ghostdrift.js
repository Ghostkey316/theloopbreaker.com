import { syncUserAction } from './syncHooks.js';

const EXACT_VERIFIED_HANDLE = 'ghostkey316.eth';

function normalizeHandle(value) {
  return (value || '').trim().toLowerCase();
}

function determineTier(handle) {
  if (!handle) {
    return 'Tier 1: Observer';
  }

  if (handle === EXACT_VERIFIED_HANDLE) {
    return 'Tier 3: Architect';
  }

  if (handle.endsWith('.eth') || handle.length > 32) {
    return 'Tier 2: Signal';
  }

  return 'Tier 1: Observer';
}

function updateInterface() {
  const walletInput = document.getElementById('wallet-input');
  const tierDisplay = document.getElementById('tier-display');
  const badge = document.getElementById('verified-badge');

  if (!walletInput || !tierDisplay || !badge) {
    return;
  }

  const normalized = normalizeHandle(walletInput.value);
  const tierLabel = determineTier(normalized);

  tierDisplay.textContent = tierLabel;
  badge.hidden = normalized !== EXACT_VERIFIED_HANDLE;
}

function handleBeliefClick() {
  const walletInput = document.getElementById('wallet-input');
  const believeBtn = document.getElementById('believe-btn');

  if (!walletInput || !believeBtn) {
    return;
  }

  const normalized = normalizeHandle(walletInput.value) || EXACT_VERIFIED_HANDLE;
  syncUserAction(normalized);

  believeBtn.textContent = 'Signal Locked';
  believeBtn.disabled = true;
  setTimeout(() => {
    believeBtn.textContent = 'I Believe';
    believeBtn.disabled = false;
  }, 2200);
}

function initGhostdrift() {
  const walletInput = document.getElementById('wallet-input');
  const believeBtn = document.getElementById('believe-btn');

  if (!walletInput || !believeBtn) {
    console.warn('Ghostdrift UI not found.');
    return;
  }

  updateInterface();

  walletInput.addEventListener('input', updateInterface);
  believeBtn.addEventListener('click', handleBeliefClick);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGhostdrift);
} else {
  initGhostdrift();
}
