/**
 * Live Audit Script - Tests actual blockchain connectivity and server endpoints
 */

const BASE_RPC = "https://mainnet.base.org";
const AVAX_RPC = "https://api.avax.network/ext/bc/C/rpc";

async function jsonRpc(rpcUrl, method, params = []) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.result;
}

async function testChain(name, rpc, expectedChainId) {
  console.log(`\n--- Testing ${name} ---`);
  try {
    const start = Date.now();
    const [blockHex, chainHex] = await Promise.all([
      jsonRpc(rpc, "eth_blockNumber"),
      jsonRpc(rpc, "eth_chainId"),
    ]);
    const latency = Date.now() - start;
    const blockNumber = parseInt(blockHex, 16);
    const chainId = parseInt(chainHex, 16);

    console.log(`  Chain ID: ${chainId} (expected: ${expectedChainId}) ${chainId === expectedChainId ? "PASS" : "FAIL"}`);
    console.log(`  Block Number: ${blockNumber.toLocaleString()}`);
    console.log(`  Latency: ${latency}ms`);
    console.log(`  Status: CONNECTED`);
    return { success: true, blockNumber, chainId, latency };
  } catch (error) {
    console.log(`  Status: FAILED - ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function testContractExists(rpc, address, name) {
  try {
    const code = await jsonRpc(rpc, "eth_getCode", [address, "latest"]);
    const exists = code !== "0x" && code !== "0x0" && code.length > 2;
    return { name, address, exists, codeLength: code.length };
  } catch (error) {
    return { name, address, exists: false, error: error.message };
  }
}

// Sample contracts to verify on-chain
const BASE_SAMPLE = [
  { name: "MissionEnforcement", address: "0x38165D2D7a8584985CCa5640f4b32b1f3347CC83" },
  { name: "VaultfireTeleporterBridge", address: "0xFe122605364f428570c4C0EB2CCAEBb68dD22d05" },
  { name: "MultisigGovernance", address: "0xea0A6750642AA294658dC9f1eDf36b95D21e7B22" },
  { name: "ERC8004IdentityRegistry", address: "0x63a3d64DfA31509DE763f6939BF586dc4C06d1D5" },
];

const AVAX_SAMPLE = [
  { name: "MissionEnforcement", address: "0xE1D52bF7A842B207B8C48eAE801f9d97A3C4D709" },
  { name: "VaultfireTeleporterBridge", address: "0x964562f712c5690465B0AA2F8fA16d9dDAc6eCdf" },
  { name: "MultisigGovernance", address: "0x4FAf741d6AcA2cBD8F72e469974C4AB0EB587aC1" },
  { name: "ERC8004IdentityRegistry", address: "0x0161c45ad09Fd8dEA6F4A7396fafa3ca1Cffc1b5" },
];

async function testServerChat() {
  console.log("\n--- Testing Server Chat Endpoint ---");
  try {
    const response = await fetch("http://127.0.0.1:3000/api/trpc/chat.send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        json: {
          messages: [{ role: "user", content: "What is the Vaultfire Protocol?" }],
          memories: [],
        },
      }),
    });
    const data = await response.json();
    const responseText = data?.result?.data?.json?.response || "";
    console.log(`  Status: ${response.status}`);
    console.log(`  Response length: ${responseText.length} chars`);
    console.log(`  Response preview: ${responseText.substring(0, 200)}...`);
    console.log(`  Contains Vaultfire: ${responseText.includes("Vaultfire") || responseText.includes("vaultfire") ? "YES" : "NO"}`);
    return { success: response.status === 200 && responseText.length > 0, responseText };
  } catch (error) {
    console.log(`  Status: FAILED - ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log("=== LIVE AUDIT: Blockchain Connectivity & Server Tests ===");
  console.log(`Timestamp: ${new Date().toISOString()}`);

  // Test chain connectivity
  const baseResult = await testChain("Base", BASE_RPC, 8453);
  const avaxResult = await testChain("Avalanche", AVAX_RPC, 43114);

  // Test sample contracts on Base
  console.log("\n--- Verifying Sample Base Contracts On-Chain ---");
  for (const c of BASE_SAMPLE) {
    const result = await testContractExists(BASE_RPC, c.address, c.name);
    console.log(`  ${c.name}: ${result.exists ? "EXISTS" : "NOT FOUND"} (code length: ${result.codeLength || "N/A"})`);
  }

  // Test sample contracts on Avalanche
  console.log("\n--- Verifying Sample Avalanche Contracts On-Chain ---");
  for (const c of AVAX_SAMPLE) {
    const result = await testContractExists(AVAX_RPC, c.address, c.name);
    console.log(`  ${c.name}: ${result.exists ? "EXISTS" : "NOT FOUND"} (code length: ${result.codeLength || "N/A"})`);
  }

  // Test server chat
  const chatResult = await testServerChat();

  // Summary
  console.log("\n=== LIVE AUDIT SUMMARY ===");
  console.log(`Base RPC: ${baseResult.success ? "PASS" : "FAIL"}`);
  console.log(`Avalanche RPC: ${avaxResult.success ? "PASS" : "FAIL"}`);
  console.log(`Server Chat: ${chatResult.success ? "PASS" : "FAIL"}`);
}

main().catch(console.error);
