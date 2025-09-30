const { Wallet } = require('ethers');
const { verifyWalletSignature } = require('../walletAuth');

describe('wallet auth handshake signature validation', () => {
  it('verifies signed handshake messages', async () => {
    const wallet = Wallet.createRandom();
    const message = `Vaultfire belief sync handshake :: wallet=${wallet.address.toLowerCase()} :: nonce=123`;
    const signature = await wallet.signMessage(message);

    const verified = verifyWalletSignature({ wallet: wallet.address, signature, message });

    expect(verified.wallet).toBe(wallet.address);
    expect(verified.message.toLowerCase()).toContain('vaultfire belief sync handshake');
  });

  it('rejects messages missing wallet anchor', () => {
    const wallet = Wallet.createRandom();
    const message = 'Vaultfire belief sync handshake :: nonce=1';
    expect(() => verifyWalletSignature({ wallet: wallet.address, signature: '0x', message })).toThrow(
      'Signed message must anchor wallet identity'
    );
  });
});
