const { ethers } = require('ethers');

function normalizeWallet(wallet) {
  if (typeof wallet !== 'string' || !wallet.trim()) {
    throw new Error('Wallet address is required');
  }
  return ethers.getAddress(wallet.trim());
}

function ensureMessageIntegrity({ message, wallet, ens }) {
  if (typeof message !== 'string' || !message.trim()) {
    throw new Error('Signed message is required');
  }

  const normalizedMessage = message.trim();
  const normalizedWallet = wallet.toLowerCase();
  const ensTag = ens ? ens.toLowerCase() : null;

  if (!normalizedMessage.toLowerCase().includes('vaultfire')) {
    throw new Error('Signature must reference Vaultfire mission text');
  }

  if (!normalizedMessage.toLowerCase().includes(normalizedWallet)) {
    throw new Error('Signed message must anchor wallet identity');
  }

  if (ensTag && !normalizedMessage.toLowerCase().includes(ensTag)) {
    throw new Error('ENS alias missing from signed message payload');
  }

  return normalizedMessage;
}

function verifyWalletSignature({ wallet, signature, message, ens }) {
  const normalizedWallet = normalizeWallet(wallet);
  const integrityCheckedMessage = ensureMessageIntegrity({
    message,
    wallet: normalizedWallet,
    ens,
  });

  if (typeof signature !== 'string' || !signature.trim()) {
    throw new Error('Signature is required');
  }

  let recovered;
  try {
    recovered = ethers.verifyMessage(integrityCheckedMessage, signature);
  } catch (error) {
    throw new Error(`Unable to verify signature: ${error.message}`);
  }

  if (recovered.toLowerCase() !== normalizedWallet.toLowerCase()) {
    throw new Error('Signature does not match wallet identity');
  }

  return {
    wallet: normalizedWallet,
    ens: ens ? ens.toLowerCase() : null,
    message: integrityCheckedMessage,
  };
}

module.exports = {
  normalizeWallet,
  verifyWalletSignature,
};
