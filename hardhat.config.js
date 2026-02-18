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
    // -----------------------------------------------------------------------
    // Base — PRIMARY / CANONICAL deployment chain
    // -----------------------------------------------------------------------
    base: {
      url: enforceLoopback(process.env.BASE_RPC_URL || sandbox.rpcUrl || 'http://127.0.0.1:8545'),
      accounts: process.env.BASE_PRIVATE_KEY ? [process.env.BASE_PRIVATE_KEY] : [],
    },
    baseSepolia: {
      url: 'https://sepolia.base.org',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 84532,
      gasPrice: 1000000000, // 1 gwei
    },
    baseMainnet: {
      url: 'https://mainnet.base.org',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 8453,
      gasPrice: 100000000,
    },
    // -----------------------------------------------------------------------
    // Avalanche — SECONDARY supported chain (Build Games program)
    // Cancun EVM opcodes supported via ACP-131 (activated Dec 2024)
    // -----------------------------------------------------------------------
    avalanche: {
      url: 'https://api.avax.network/ext/bc/C/rpc',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 43114,
    },
    avalancheFuji: {
      url: 'https://api.avax-test.network/ext/bc/C/rpc',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 43113,
    },
  },
  etherscan: {
    apiKey: {
      baseSepolia: process.env.BASESCAN_API_KEY || "",
      baseMainnet: process.env.BASESCAN_API_KEY || "",
      avalanche: process.env.SNOWTRACE_API_KEY || "snowtrace",
      avalancheFuji: process.env.SNOWTRACE_API_KEY || "snowtrace",
    },
    customChains: [
      {
        network: "avalanche",
        chainId: 43114,
        urls: {
          apiURL: "https://api.routescan.io/v2/network/mainnet/evm/43114/etherscan",
          browserURL: "https://snowtrace.io",
        },
      },
      {
        network: "avalancheFuji",
        chainId: 43113,
        urls: {
          apiURL: "https://api.routescan.io/v2/network/testnet/evm/43113/etherscan",
          browserURL: "https://testnet.snowtrace.io",
        },
      },
    ],
  },
  paths: {
    tests: "test",
  },
  vaultfireSandbox: sandbox,
};
