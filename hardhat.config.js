const { applyHardhatSandbox, enforceLoopback } = require('./infra/hardhat-sandbox');

const sandbox = applyHardhatSandbox();

require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-verify");

module.exports = {
  solidity: {
    compilers: [
      { version: "0.8.20" },
      {
        version: "0.8.25",
        settings: {
          viaIR: true,
          evmVersion: "cancun",
          optimizer: { enabled: true, runs: 200 },
        },
      },
    ],
  },
  networks: {
    base: {
      url: enforceLoopback(process.env.BASE_RPC_URL || sandbox.rpcUrl || 'http://127.0.0.1:8545'),
      accounts: process.env.BASE_PRIVATE_KEY ? [process.env.BASE_PRIVATE_KEY] : [],
    },
    baseMainnet: {
      url: 'https://mainnet.base.org',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 8453,
      gasPrice: 100000000,
    },
  },
  verify: {
    etherscan: {
      apiKey: {
        baseMainnet: process.env.BASESCAN_API_KEY || "",
      },
    },
  },
  paths: {
    tests: "contracts/test",
  },
  vaultfireSandbox: sandbox,
};
