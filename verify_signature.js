// Utility to verify EIP-191 (personal_sign) signatures
// Requires the `ethers` library
// message: original signed string
// wallet: wallet address expected to have signed the message
// xp: numeric XP value expected inside the message
// Returns true if signature valid, message contains the confirmation text,
// the XP matches, and timestamp has not expired.

const { ethers } = require('ethers');

function verifyVaultfireSignature({ message, signature, wallet, xp }) {
  if (typeof message !== 'string' || typeof signature !== 'string' || typeof wallet !== 'string') {
    throw new Error('Invalid arguments');
  }

  if (!message.includes('Vaultfire XP Confirmation')) {
    return false;
  }

  const tsMatch = message.match(/timestamp=(\d+)/);
  if (!tsMatch) return false;
  const timestamp = parseInt(tsMatch[1], 10);
  if (Date.now() > timestamp) return false;

  const xpMatch = message.match(/xp=(\d+)/i);
  if (!xpMatch) return false;
  const msgXp = parseInt(xpMatch[1], 10);
  if (msgXp !== xp) return false;

  let recovered;
  try {
    const hash = ethers.utils.hashMessage(message);
    recovered = ethers.utils.recoverAddress(hash, signature);
  } catch {
    return false;
  }

  return recovered.toLowerCase() === wallet.toLowerCase();
}

module.exports = { verifyVaultfireSignature };
