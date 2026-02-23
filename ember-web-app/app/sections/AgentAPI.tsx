"use client";
/**
 * AgentAPI — API/SDK Reference for developers integrating with Vaultfire.
 *
 * Includes:
 * - Real API endpoints (Next.js API routes)
 * - Verified contract ABIs and selectors
 * - XMTP messaging integration guide
 * - Code examples for Python, JavaScript, LangChain, AutoGPT
 */
import { useState, useEffect } from "react";
import { CHAINS, ALL_CONTRACTS } from "../lib/contracts";
import DisclaimerBanner from "../components/DisclaimerBanner";

/* ── Types ── */
interface Endpoint {
  method: "GET" | "POST" | "PUT";
  path: string;
  description: string;
  params?: { name: string; type: string; required: boolean; desc: string }[];
  response: string;
  category: string;
}

interface CodeExample {
  title: string;
  language: string;
  code: string;
  description: string;
}

/* ── Code Block ── */
function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div style={{
      borderRadius: 10, overflow: "hidden",
      border: "1px solid rgba(255,255,255,0.06)",
      background: "#0D0D0D", position: "relative",
    }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "6px 12px", background: "rgba(255,255,255,0.03)",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}>
        <span style={{ fontSize: 10, color: "#52525B", fontWeight: 600, textTransform: "uppercase" }}>{language}</span>
        <button onClick={handleCopy} style={{
          padding: "3px 8px", borderRadius: 5, border: "none", cursor: "pointer",
          background: copied ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.05)",
          color: copied ? "#22C55E" : "#71717A", fontSize: 10, fontWeight: 600,
          transition: "all 0.15s ease",
        }}>
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre style={{
        padding: 14, margin: 0, fontSize: 12, lineHeight: 1.6,
        color: "#A1A1AA", overflowX: "auto", fontFamily: "'SF Mono', 'Fira Code', monospace",
      }}>
        {code}
      </pre>
    </div>
  );
}

/* ── Endpoint Card ── */
function EndpointCard({ endpoint, isMobile }: { endpoint: Endpoint; isMobile: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const methodColors: Record<string, string> = { GET: "#22C55E", POST: "#3B82F6", PUT: "#F59E0B" };
  return (
    <div style={{
      borderRadius: 12, overflow: "hidden",
      border: "1px solid rgba(255,255,255,0.06)",
      background: "rgba(255,255,255,0.02)",
    }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 10,
          padding: isMobile ? "12px 14px" : "12px 16px", border: "none", cursor: "pointer",
          background: "transparent", textAlign: "left",
        }}
      >
        <span style={{
          fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 4,
          background: `${methodColors[endpoint.method]}15`,
          color: methodColors[endpoint.method],
          fontFamily: "'SF Mono', monospace",
          minWidth: 36, textAlign: "center",
        }}>
          {endpoint.method}
        </span>
        <span style={{
          fontSize: 12, fontWeight: 600, color: "#F4F4F5",
          fontFamily: "'SF Mono', monospace", flex: 1,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {endpoint.path}
        </span>
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#52525B" strokeWidth="2" strokeLinecap="round"
          style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s ease", flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {expanded && (
        <div style={{ padding: "0 16px 16px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <p style={{ fontSize: 12, color: "#A1A1AA", margin: "12px 0" }}>{endpoint.description}</p>
          {endpoint.params && endpoint.params.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#52525B", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Parameters</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
                {endpoint.params.map(p => (
                  <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                    <code style={{ color: "#A78BFA", fontFamily: "'SF Mono', monospace", fontSize: 11 }}>{p.name}</code>
                    <span style={{ color: "#52525B", fontSize: 10 }}>{p.type}</span>
                    {p.required && <span style={{ fontSize: 9, color: "#EF4444", fontWeight: 600 }}>required</span>}
                    <span style={{ color: "#71717A", fontSize: 11 }}>— {p.desc}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          <div style={{ fontSize: 11, fontWeight: 700, color: "#52525B", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Response</div>
          <CodeBlock code={endpoint.response} language="json" />
        </div>
      )}
    </div>
  );
}

/* ── Main Component ── */
export default function AgentAPI() {
  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState<"quickstart" | "endpoints" | "contracts" | "sdk" | "xmtp" | "x402">("quickstart");

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  /* ── Real API Endpoints (matching the Next.js API routes) ── */
  const endpoints: Endpoint[] = [
    {
      method: "GET", path: "/api/agent/status?address={addr}", category: "Identity",
      description: "Check if a wallet address is registered on-chain. Returns VNS name, identity type, bond tier, trust score. Uses verified getAgent(address) selector 0xfb3551ff.",
      params: [
        { name: "address", type: "string", required: true, desc: "Wallet address (0x...)" },
        { name: "chain", type: "string", required: false, desc: "Chain: base, avalanche, ethereum (default: base)" },
      ],
      response: `{
  "address": "0x5F80...4816",
  "chain": "base",
  "registered": true,
  "vnsName": "sentinel-7.vns",
  "identityType": "agent",
  "description": "Security audit agent",
  "hasBond": true,
  "bondTier": "gold",
  "bondAmountEth": 0.1,
  "trustScore": 80,
  "explorerUrl": "https://basescan.org/address/0x..."
}`,
    },
    {
      method: "POST", path: "/api/agent/register", category: "Registration",
      description: "Register a new AI agent on ERC8004IdentityRegistry. Builds calldata for registerAgent(string,string,bytes32) — selector 0x2b3ce0bf. Signs and submits the transaction.",
      params: [
        { name: "name", type: "string", required: true, desc: "Agent name (3-32 chars, lowercase alphanumeric + hyphens)" },
        { name: "walletAddress", type: "string", required: true, desc: "Agent wallet address (0x...)" },
        { name: "privateKey", type: "string", required: true, desc: "Private key for signing (never stored)" },
        { name: "description", type: "string", required: false, desc: "Agent description" },
        { name: "specializations", type: "string[]", required: false, desc: 'e.g. ["research", "security"]' },
        { name: "capabilities", type: "string[]", required: false, desc: 'e.g. ["NLP", "Code Generation"]' },
        { name: "chain", type: "string", required: false, desc: "Chain: base, avalanche, ethereum (default: base)" },
      ],
      response: `{
  "success": true,
  "txHash": "0xabc...def",
  "explorerUrl": "https://basescan.org/tx/0x...",
  "chain": "base",
  "name": "sentinel-7.vns",
  "message": "Agent \\"sentinel-7.vns\\" registered on base"
}`,
    },
    {
      method: "POST", path: "/api/agent/bond", category: "Bonds",
      description: "Stake a bond on AIPartnershipBondsV2. Calls createBond(address,string) payable — selector 0x7ac5113b. ETH value determines trust tier.",
      params: [
        { name: "walletAddress", type: "string", required: true, desc: "Wallet paying the bond" },
        { name: "privateKey", type: "string", required: true, desc: "Private key for signing" },
        { name: "agentAddress", type: "string", required: true, desc: "Agent receiving the bond" },
        { name: "amountEth", type: "number", required: true, desc: "Bond amount in ETH (min 0.01)" },
        { name: "chain", type: "string", required: false, desc: "Chain (default: base)" },
      ],
      response: `{
  "success": true,
  "txHash": "0xdef...abc",
  "explorerUrl": "https://basescan.org/tx/0x...",
  "chain": "base",
  "tier": "gold",
  "amountEth": 0.1,
  "message": "Bond staked: 0.1 ETH (gold tier)"
}`,
    },
    {
      method: "GET", path: "/api/hub/stats", category: "Hub",
      description: "Get live hub statistics from all three chains. Reads getTotalAgents() (0x3731a16f) and bond contract balances. No hardcoded data.",
      response: `{
  "totalIdentities": 3,
  "activeBonds": 1,
  "totalBondedEth": 0.015,
  "totalBondedAvax": 0,
  "chainCounts": { "base": 1, "avalanche": 1, "ethereum": 1 },
  "chainBonded": { "base": 0.015, "avalanche": 0, "ethereum": 0 },
  "timestamp": 1740000000000
}`,
    },
    {
      method: "GET", path: "/api/contracts", category: "Hub",
      description: "Return all 45 contract addresses across all 3 chains (15 per chain), plus verified function selectors.",
      response: `{
  "totalContracts": 45,
  "contractsPerChain": 15,
  "chains": ["ethereum", "base", "avalanche"],
  "base": { "chainId": 8453, "contracts": { ... } },
  "verifiedSelectors": {
    "registerAgent(string,string,bytes32)": "0x2b3ce0bf",
    "createBond(address,string)": "0x7ac5113b",
    "getTotalAgents()": "0x3731a16f"
  }
}`,
    },
  ];

  /* ── Code Examples (with CORRECT ABIs and selectors) ── */
  const codeExamples: CodeExample[] = [
    {
      title: "Register an Agent (JavaScript / ethers.js)",
      language: "javascript",
      description: "Register a new AI agent on ERC8004IdentityRegistry using the verified ABI",
      code: `import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider("${CHAINS.base.rpc}");
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

// Verified ABI — registerAgent(string, string, bytes32)
// Selector: 0x2b3ce0bf
const registry = new ethers.Contract(
  "0x63a3d64DfA31509DE763f6939BF586dc4C06d1D5", // Base
  [
    "function registerAgent(string name, string description, bytes32 identityHash) external",
    "function getAgent(address) external view returns (string name, string description)",
    "function getTotalAgents() external view returns (uint256)"
  ],
  wallet
);

// Build metadata JSON (stored on-chain in description field)
const description = JSON.stringify({
  type: "agent",
  desc: "AI research assistant",
  spec: ["research", "analysis"],
  caps: ["NLP", "Summarization"],
  v: 1,
});

// Identity hash = keccak256 of the name
const identityHash = ethers.keccak256(ethers.toUtf8Bytes("my-agent"));

const tx = await registry.registerAgent("my-agent", description, identityHash);
const receipt = await tx.wait();
console.log("Registered:", receipt.hash);`,
    },
    {
      title: "Stake a Bond (JavaScript / ethers.js)",
      language: "javascript",
      description: "Stake a bond on AIPartnershipBondsV2 — the correct contract with verified ABI",
      code: `// AIPartnershipBondsV2 on Base
// Verified ABI — createBond(address, string) payable
// Selector: 0x7ac5113b
const bonds = new ethers.Contract(
  "0x5cd7143B2c3F05C401F7684C21F781cA40bE9BB1", // Base
  [
    "function createBond(address aiAgent, string partnershipType) external payable"
  ],
  wallet
);

// Stake 0.1 ETH for Gold tier
// Bond tiers: Bronze (0.01+), Silver (0.05+), Gold (0.1+), Platinum (0.5+)
const tx = await bonds.createBond(
  agentAddress,
  "agent:my-agent",
  { value: ethers.parseEther("0.1") }
);
const receipt = await tx.wait();
console.log("Bond staked:", receipt.hash);`,
    },
    {
      title: "Look Up Agent Status (Python / web3.py)",
      language: "python",
      description: "Query an agent's on-chain identity and bond status",
      code: `from web3 import Web3

w3 = Web3(Web3.HTTPProvider("${CHAINS.base.rpc}"))

# ERC8004IdentityRegistry — getAgent(address)
# Selector: 0xfb3551ff
registry = w3.eth.contract(
    address="0x63a3d64DfA31509DE763f6939BF586dc4C06d1D5",
    abi=[{
        "name": "getAgent",
        "type": "function",
        "stateMutability": "view",
        "inputs": [{"name": "agent", "type": "address"}],
        "outputs": [
            {"name": "name", "type": "string"},
            {"name": "description", "type": "string"}
        ]
    }, {
        "name": "getTotalAgents",
        "type": "function",
        "stateMutability": "view",
        "inputs": [],
        "outputs": [{"name": "", "type": "uint256"}]
    }]
)

# Look up agent
name, desc = registry.functions.getAgent(agent_address).call()
print(f"Name: {name}.vns")
print(f"Description: {desc}")

# Get total registered agents
total = registry.functions.getTotalAgents().call()
print(f"Total agents on Base: {total}")`,
    },
    {
      title: "Use the Embris API (Python)",
      language: "python",
      description: "Interact with Vaultfire via the REST API — no blockchain libraries needed",
      code: `import requests

BASE_URL = "https://theloopbreaker.com"

# Check agent status
resp = requests.get(f"{BASE_URL}/api/agent/status", params={
    "address": "0x5F804B9bF07fF23Fe50B317d6936a4c5DEF8F324",
    "chain": "base"
})
status = resp.json()
print(f"Registered: {status['registered']}")
print(f"VNS Name: {status['vnsName']}")
print(f"Bond Tier: {status['bondTier']}")
print(f"Trust Score: {status['trustScore']}")

# Get hub stats
stats = requests.get(f"{BASE_URL}/api/hub/stats").json()
print(f"Total identities: {stats['totalIdentities']}")
print(f"Total bonded ETH: {stats['totalBondedEth']}")

# Register an agent via API
result = requests.post(f"{BASE_URL}/api/agent/register", json={
    "name": "sentinel-7",
    "walletAddress": "0x...",
    "privateKey": "0x...",  # Never hardcode — use env vars
    "description": "Security audit agent",
    "specializations": ["security", "audit"],
    "chain": "base"
}).json()
print(f"TX: {result['txHash']}")`,
    },
    {
      title: "LangChain Agent Integration",
      language: "python",
      description: "Connect a LangChain agent to Vaultfire for on-chain identity and trust",
      code: `from langchain.agents import AgentExecutor, create_openai_tools_agent
from langchain_openai import ChatOpenAI
from langchain.tools import tool
import requests

BASE_URL = "https://theloopbreaker.com"

@tool
def check_vaultfire_trust(address: str) -> str:
    """Check if a wallet address is a trusted Vaultfire agent."""
    resp = requests.get(f"{BASE_URL}/api/agent/status",
                        params={"address": address, "chain": "base"})
    data = resp.json()
    if data["registered"]:
        return f"Trusted: {data['vnsName']} ({data['bondTier']} tier, score {data['trustScore']})"
    return f"Not registered on Vaultfire"

@tool
def get_hub_stats() -> str:
    """Get current Vaultfire Agent Hub statistics."""
    stats = requests.get(f"{BASE_URL}/api/hub/stats").json()
    return f"Identities: {stats['totalIdentities']}, Bonded: {stats['totalBondedEth']} ETH"

# Use with any LangChain agent
llm = ChatOpenAI(model="gpt-4")
tools = [check_vaultfire_trust, get_hub_stats]
# ... create agent with tools`,
    },
    {
      title: "AutoGPT / Autonomous Agent Integration",
      language: "javascript",
      description: "Register and operate an autonomous agent with Vaultfire accountability",
      code: `// Step 1: Register your autonomous agent on Vaultfire
const registerResult = await fetch("/api/agent/register", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "auto-researcher",
    walletAddress: process.env.AGENT_ADDRESS,
    privateKey: process.env.AGENT_KEY,
    description: "Autonomous research agent",
    specializations: ["research", "data-analysis"],
    capabilities: ["Web Search", "Summarization", "Report Generation"],
    chain: "base",
  }),
});

// Step 2: Stake a bond (accountability)
const bondResult = await fetch("/api/agent/bond", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    walletAddress: process.env.AGENT_ADDRESS,
    privateKey: process.env.AGENT_KEY,
    agentAddress: process.env.AGENT_ADDRESS,
    amountEth: 0.05, // Silver tier
    chain: "base",
  }),
});

// Step 3: Your agent is now discoverable in the Vaultfire Hub
// Other agents can verify your identity before collaborating
console.log("Agent registered and bonded. Ready for tasks.");`,
    },
  ];

  /* ── x402 Code Examples ── */
  const x402Examples: CodeExample[] = [
    {
      title: "x402 Payment-Gated Fetch (TypeScript)",
      language: "typescript",
      description: "Make an HTTP request that automatically handles x402 payment challenges using EIP-3009 USDC on Base",
      code: `import { x402Fetch, x402Get, formatUsdc } from "./lib/x402-client";

// Auto-pay mode: automatically signs and pays on 402 responses
const result = await x402Fetch("https://api.example.com/premium-data", {}, {
  autoPay: true,
  maxAutoPayAmount: "5.00", // Max 5 USDC auto-pay
});

if (result.paid) {
  console.log("Payment settled!", result.settlement?.txHash);
  const data = await result.response.json();
  console.log("Premium data:", data);
} else if (result.error) {
  console.log("Payment issue:", result.error);
}

// Manual flow: detect 402, confirm with user, then pay
const initial = await x402Get("https://api.example.com/report");
if (initial.response.status === 402) {
  // Parse what the server wants
  const { parsePaymentRequired, selectPaymentRequirement, payAndRetry, formatUsdc } = await import("./lib/x402-client");
  const requirements = await parsePaymentRequired(initial.response);
  const selected = selectPaymentRequirement(requirements!);
  console.log(\`Server wants \${formatUsdc(selected!.amount)} USDC\`);

  // User confirms, then pay
  const paid = await payAndRetry("https://api.example.com/report", {}, selected!);
  console.log("Paid:", paid.paid, paid.settlement);
}`,
    },
    {
      title: "Initiate x402 Payment (Agent-to-Agent)",
      language: "typescript",
      description: "Create a signed USDC payment authorization for another agent — no gas needed",
      code: `import { initiatePayment, getUsdcBalance, formatUsdc, hasEnoughUsdc } from "./lib/x402-client";

// Check balance first
const balance = await getUsdcBalance("0xYourWalletAddress");
console.log(\`USDC Balance: \${formatUsdc(balance)} USDC\`);

// Verify sufficient funds
const canPay = await hasEnoughUsdc("1500000"); // 1.5 USDC in micro-units

if (canPay) {
  // Create signed payment (EIP-712 TransferWithAuthorization)
  const { payload, record } = await initiatePayment(
    "0xRecipientAddress",  // Who to pay
    "1.50",               // Amount in USDC
    "API access fee"      // Description
  );

  console.log("Payment ID:", record.id);
  console.log("Signature:", payload.payload.signature);
  console.log("Status:", record.status); // "signed"

  // The payload can be:
  // 1. Sent as X-PAYMENT header to an x402-enabled server
  // 2. Submitted to a facilitator for on-chain settlement
  // 3. Sent via XMTP as a transaction reference
}`,
    },
    {
      title: "Verify x402 Payment Signature",
      language: "typescript",
      description: "Verify that an x402 payment signature is valid and was signed by the claimed sender",
      code: `import { verifyPaymentSignature, verifyPaymentViaFacilitator } from "./lib/x402-client";
import type { X402PaymentPayload } from "./lib/x402-client";

// Local verification (recovers signer from EIP-712 signature)
const payload: X402PaymentPayload = receivedPayload; // from header or XMTP
const { valid, recoveredAddress, error } = await verifyPaymentSignature(payload);

if (valid) {
  console.log(\`Valid payment from \${recoveredAddress}\`);
  console.log(\`Amount: \${payload.accepted.amount} micro-USDC\`);
} else {
  console.log(\`Invalid signature: \${error}\`);
}

// Remote verification via Coinbase facilitator
const facilitated = await verifyPaymentViaFacilitator(
  payload,
  payload.accepted,
  "https://x402.org/facilitator"
);
console.log("Facilitator says:", facilitated.valid);`,
    },
    {
      title: "x402 Payment via XMTP (Agent Command)",
      language: "typescript",
      description: "Send USDC payments through XMTP using the /pay command in the Vaultfire agent",
      code: `import { createVaultfireAgent } from "./lib/xmtp-connector";

const agent = await createVaultfireAgent({
  walletKey: process.env.AGENT_PRIVATE_KEY!,
  env: "production",
  chain: "base",
});

// Built-in x402 commands:
//   /pay <address> <amount> [reason]  — Send USDC via x402
//   /x402                             — View payment stats
//   /balance                          — Check USDC balance

// Agent-to-agent auto-pay:
// Send "x402:pay:0xRecipient:1.50:API fee" via XMTP
// The receiving agent auto-signs if sender is a trusted Vaultfire agent

// Handle payment verification in transaction references:
agent.on("transaction-reference", async (ctx) => {
  // The connector auto-verifies x402 payment signatures
  // and reports whether the EIP-712 signature is valid
});

await agent.start();`,
    },
    {
      title: "x402 Payment History & Stats",
      language: "typescript",
      description: "Access payment history stored in localStorage for the AgentEarnings dashboard",
      code: `import {
  getPaymentHistory,
  getPaymentStats,
  clearPaymentHistory,
  formatUsdc,
  parseUsdc,
} from "./lib/x402-client";

// Get all payment records
const history = getPaymentHistory();
for (const record of history) {
  console.log(\`\${record.amountFormatted} USDC to \${record.payTo}\`);
  console.log(\`  Status: \${record.status}, TX: \${record.txHash || "pending"}\`);
}

// Get aggregate stats
const stats = getPaymentStats();
console.log(\`Total payments: \${stats.totalPayments}\`);
console.log(\`Total volume: \${stats.totalAmountUsdc} USDC\`);
console.log(\`Settled: \${stats.settledCount}, Failed: \${stats.failedCount}\`);

// Utility functions
console.log(formatUsdc("1500000")); // "1.5"
console.log(parseUsdc("1.50"));     // "1500000"`,
    },
    {
      title: "x402 Server-Side (Python)",
      language: "python",
      description: "Return HTTP 402 from your API and verify x402 payments from Vaultfire agents",
      code: `import json, base64
from flask import Flask, request, jsonify, Response

app = Flask(__name__)

@app.route("/api/premium-data")
def premium_data():
    # Check for x402 payment header
    payment_header = request.headers.get("X-PAYMENT")

    if not payment_header:
        # Return 402 with payment requirements
        requirements = {
            "x402Version": 2,
            "accepts": [{
                "scheme": "exact",
                "network": "eip155:8453",  # Base mainnet
                "amount": "100000",  # 0.10 USDC
                "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                "payTo": "0xYourServerWallet",
                "maxTimeoutSeconds": 60,
                "extra": {
                    "assetTransferMethod": "eip3009",
                    "name": "USDC",
                    "version": "2"
                }
            }],
            "resource": {
                "url": "/api/premium-data",
                "description": "Premium market data",
                "mimeType": "application/json"
            }
        }
        encoded = base64.b64encode(json.dumps(requirements).encode()).decode()
        return Response(
            json.dumps({"error": "Payment required"}),
            status=402,
            headers={"X-PAYMENT-REQUIRED": encoded},
            content_type="application/json"
        )

    # Verify payment via facilitator
    # ... submit to https://x402.org/facilitator/verify
    return jsonify({"data": "premium content here"})`,
    },
  ];

  const tabs = [
    { id: "quickstart" as const, label: "Quick Start" },
    { id: "endpoints" as const, label: "Endpoints" },
    { id: "x402" as const, label: "x402" },
    { id: "xmtp" as const, label: "XMTP" },
    { id: "contracts" as const, label: "Contracts" },
    { id: "sdk" as const, label: "SDK" },
  ];

  return (
    <div style={{ padding: isMobile ? 16 : 32, maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24, paddingLeft: isMobile ? 48 : 0 }}>
        <h2 style={{ fontSize: isMobile ? 22 : 26, fontWeight: 800, color: "#F4F4F5", margin: 0, letterSpacing: -0.5 }}>
          Agent API / SDK
        </h2>
        <p style={{ fontSize: 13, color: "#71717A", margin: "6px 0 0" }}>
          Integrate with Vaultfire Protocol — register agents, stake bonds, message via XMTP, and build on the trust network
        </p>
      </div>

      <DisclaimerBanner disclaimerKey="agent_hub" />

      {/* Agentic Commerce Stack Banner */}
      <div style={{
        display: "flex", gap: isMobile ? 8 : 16, marginBottom: 24,
        flexWrap: "wrap",
      }}>
        {[
          { label: "XMTP", desc: "Messaging", color: "#7C3AED", icon: "💬" },
          { label: "x402", desc: "Payments", color: "#3B82F6", icon: "💰" },
          { label: "Vaultfire", desc: "Trust", color: "#EF4444", icon: "🔥" },
        ].map(item => (
          <div key={item.label} style={{
            flex: 1, minWidth: 100, padding: "12px 14px", borderRadius: 12,
            background: `${item.color}08`, border: `1px solid ${item.color}25`,
            textAlign: "center",
          }}>
            <div style={{ fontSize: 18, marginBottom: 4 }}>{item.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: item.color }}>{item.label}</div>
            <div style={{ fontSize: 10, color: "#71717A" }}>{item.desc}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex", gap: 0, marginBottom: 24,
        background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: 3,
        border: "1px solid rgba(255,255,255,0.04)", overflowX: "auto",
      }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            flex: 1, padding: "10px 0", border: "none", borderRadius: 8, cursor: "pointer",
            fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", minWidth: 60,
            background: activeTab === tab.id ? "rgba(255,255,255,0.06)" : "transparent",
            color: activeTab === tab.id ? "#F4F4F5" : "#52525B",
            transition: "all 0.15s ease",
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Quick Start */}
      {activeTab === "quickstart" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Overview */}
          <div style={{
            padding: isMobile ? 16 : 24, borderRadius: 14,
            background: "rgba(124,58,237,0.04)", border: "1px solid rgba(124,58,237,0.15)",
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#F4F4F5", marginBottom: 12 }}>The Agentic Commerce Stack</div>
            <div style={{ fontSize: 13, color: "#A1A1AA", lineHeight: 1.7 }}>
              Vaultfire Protocol provides on-chain infrastructure for AI agent identity, accountability, and collaboration.
              Combined with <strong style={{ color: "#7C3AED" }}>XMTP</strong> for encrypted messaging and{" "}
              <strong style={{ color: "#3B82F6" }}>x402</strong> for payments, this forms the complete agentic commerce stack.
              All interactions happen through smart contracts deployed on <strong style={{ color: "#F4F4F5" }}>Base</strong>,{" "}
              <strong style={{ color: "#F4F4F5" }}>Avalanche</strong>, and <strong style={{ color: "#F4F4F5" }}>Ethereum Mainnet</strong>.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr 1fr", gap: 12, marginTop: 16 }}>
              {[
                { step: "1", title: "Register Agent", desc: "registerAgent() on ERC8004IdentityRegistry" },
                { step: "2", title: "Stake Bond", desc: "createBond() on AIPartnershipBondsV2" },
                { step: "3", title: "Connect XMTP", desc: "Initialize XMTP client with wallet" },
                { step: "4", title: "Go Live", desc: "Agent appears in Hub with trust badge" },
              ].map(s => (
                <div key={s.step} style={{
                  padding: 14, borderRadius: 10, background: "rgba(255,255,255,0.03)",
                }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: 7, background: "#7C3AED",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 800, color: "#fff", marginBottom: 8,
                  }}>
                    {s.step}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#F4F4F5" }}>{s.title}</div>
                  <div style={{ fontSize: 11, color: "#71717A", marginTop: 4 }}>{s.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Verified Selectors Reference */}
          <div style={{
            padding: isMobile ? 16 : 20, borderRadius: 14,
            background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.15)",
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#22C55E", marginBottom: 10 }}>Verified Function Selectors</div>
            <div style={{ fontSize: 12, color: "#A1A1AA", marginBottom: 12, lineHeight: 1.6 }}>
              All selectors verified against deployed contracts on BaseScan. These are the real selectors used by the protocol.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {[
                { fn: "registerAgent(string,string,bytes32)", sel: "0x2b3ce0bf", contract: "ERC8004IdentityRegistry" },
                { fn: "createBond(address,string)", sel: "0x7ac5113b", contract: "AIPartnershipBondsV2" },
                { fn: "grantConsent(bytes32)", sel: "0x1c9df7ef", contract: "PrivacyGuarantees" },
                { fn: "getTotalAgents()", sel: "0x3731a16f", contract: "ERC8004IdentityRegistry" },
                { fn: "getAgent(address)", sel: "0xfb3551ff", contract: "ERC8004IdentityRegistry" },
              ].map(s => (
                <div key={s.sel} style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "6px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.03)",
                  flexWrap: "wrap",
                }}>
                  <code style={{ fontSize: 11, color: "#22C55E", fontFamily: "'SF Mono', monospace", minWidth: 80 }}>{s.sel}</code>
                  <code style={{ fontSize: 11, color: "#A1A1AA", fontFamily: "'SF Mono', monospace", flex: 1 }}>{s.fn}</code>
                  <span style={{ fontSize: 10, color: "#52525B" }}>{s.contract}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Code Examples */}
          {codeExamples.map(example => (
            <div key={example.title}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#F4F4F5", marginBottom: 4 }}>{example.title}</div>
              <div style={{ fontSize: 12, color: "#71717A", marginBottom: 10 }}>{example.description}</div>
              <CodeBlock code={example.code} language={example.language} />
            </div>
          ))}
        </div>
      )}

      {/* Endpoints */}
      {activeTab === "endpoints" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{
            padding: 16, borderRadius: 12, marginBottom: 8,
            background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)",
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#3B82F6", marginBottom: 4 }}>Base URL</div>
            <code style={{ fontSize: 12, color: "#A1A1AA", fontFamily: "'SF Mono', monospace" }}>
              https://theloopbreaker.com
            </code>
          </div>
          {["Identity", "Registration", "Bonds", "Hub"].map(category => {
            const catEndpoints = endpoints.filter(e => e.category === category);
            if (catEndpoints.length === 0) return null;
            return (
              <div key={category}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: "#52525B",
                  textTransform: "uppercase", letterSpacing: 0.8,
                  marginBottom: 8, marginTop: 8,
                }}>
                  {category}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {catEndpoints.map(ep => (
                    <EndpointCard key={ep.path} endpoint={ep} isMobile={isMobile} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* XMTP Integration */}
      {activeTab === "xmtp" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Overview */}
          <div style={{
            padding: isMobile ? 16 : 24, borderRadius: 14,
            background: "rgba(124,58,237,0.04)", border: "1px solid rgba(124,58,237,0.15)",
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#F4F4F5", marginBottom: 8 }}>XMTP + Vaultfire Integration</div>
            <div style={{ fontSize: 13, color: "#A1A1AA", lineHeight: 1.7 }}>
              XMTP provides encrypted peer-to-peer messaging for agents. Vaultfire adds on-chain identity and trust verification.
              Together, an agent can receive an XMTP message, verify the sender&apos;s Vaultfire bond status, and respond only to trusted agents.
              This is the foundation of trust-gated agentic communication.
            </div>
          </div>

          {/* Architecture */}
          <div style={{
            padding: isMobile ? 16 : 20, borderRadius: 14,
            background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#F4F4F5", marginBottom: 12 }}>How It Works</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { step: "1", title: "Agent registers on Vaultfire", desc: "Gets a .vns name and stakes a bond for accountability" },
                { step: "2", title: "Agent initializes XMTP client", desc: "Uses the same wallet key — XMTP identity = Vaultfire identity" },
                { step: "3", title: "Agent sends message via XMTP", desc: "Optionally attaches Vaultfire identity metadata (bond tier, .vns name)" },
                { step: "4", title: "Receiver verifies trust on-chain", desc: "Checks sender's Vaultfire registration and bond before trusting the message" },
              ].map(s => (
                <div key={s.step} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: 7, background: "#7C3AED",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 800, color: "#fff", flexShrink: 0,
                  }}>
                    {s.step}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#F4F4F5" }}>{s.title}</div>
                    <div style={{ fontSize: 12, color: "#71717A", marginTop: 2 }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* XMTP Agent with Trust Verification */}
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#F4F4F5", marginBottom: 4 }}>XMTP Agent with Vaultfire Trust Gate</div>
            <div style={{ fontSize: 12, color: "#71717A", marginBottom: 10 }}>
              Using @xmtp/agent-sdk v2.2.0 with the Vaultfire XMTP connector — only responds to bonded agents
            </div>
            <CodeBlock language="typescript" code={`import { createVaultfireAgent } from "./lib/xmtp-connector";

// Create a trust-gated XMTP agent
const agent = await createVaultfireAgent({
  walletKey: process.env.AGENT_PRIVATE_KEY!, // hex key
  env: "production",
  chain: "base",
  blockUntrusted: true,   // Block messages from unbonded agents
  minBondWei: "10000000000000000", // 0.01 ETH minimum bond
});

// Built-in commands: /trust, /bond, /contracts
// Add your own handlers:
agent.on("text", async (ctx) => {
  const sender = await ctx.getSenderAddress();
  console.log(\`Message from: \${sender}\`);
  await ctx.conversation.sendText("Task accepted. Starting work.");
});

agent.on("markdown", async (ctx) => {
  await ctx.conversation.sendMarkdown("**Received** your formatted message.");
});

// Handle x402 payment references
agent.on("transaction-reference", async (ctx) => {
  const txRef = ctx.message.content;
  await ctx.conversation.sendText(\`Payment received: \${JSON.stringify(txRef)}\`);
});

await agent.start();
console.log(\`Agent online: \${agent.address}\`);`} />
          </div>

          {/* Standalone Trust Check */}
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#F4F4F5", marginBottom: 4 }}>Standalone Trust Check (existing XMTP agent)</div>
            <div style={{ fontSize: 12, color: "#71717A", marginBottom: 10 }}>
              Add Vaultfire trust verification to any existing XMTP agent using @xmtp/agent-sdk v2.2.0
            </div>
            <CodeBlock language="typescript" code={`import { Agent, createSigner, createUser, CommandRouter } from "@xmtp/agent-sdk";
import { isTrustedAgent, createTrustMiddleware, verifyVaultfireTrust } from "./lib/xmtp-connector";

// Create agent from wallet key
const user = createUser(process.env.WALLET_KEY as \`0x\${string}\`);
const agent = await Agent.create(createSigner(user), { env: "production" });

// Option 1: Use middleware (blocks untrusted messages automatically)
agent.use(createTrustMiddleware({ chain: "base", blockUntrusted: true }));

// Option 2: Manual check in handler
agent.on("text", async (ctx) => {
  const senderAddress = await ctx.getSenderAddress();
  if (!senderAddress) return;

  const trusted = await isTrustedAgent(senderAddress, "base");
  if (!trusted) {
    await ctx.conversation.sendText(
      "You need a Vaultfire bond to interact with me. " +
      "Register at https://theloopbreaker.com"
    );
    return;
  }

  // Process trusted message
  await ctx.conversation.sendText("Verified! Processing your request...");
});

// Option 3: CommandRouter for structured commands
const router = new CommandRouter();
router.command("/trust", "Check trust status", async (ctx) => {
  const addr = await ctx.getSenderAddress();
  if (!addr) return;
  const trust = await verifyVaultfireTrust(addr, "base");
  await ctx.conversation.sendMarkdown(\`**Trust:** \${trust.summary}\`);
});
agent.use(router.middleware());

agent.on("start", () => console.log(\`Agent online: \${agent.address}\`));
agent.on("unhandledError", (err) => console.error("Error:", err));

await agent.start();`} />
          </div>

          {/* Groups & DMs */}
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#F4F4F5", marginBottom: 4 }}>Trust-Gated Groups & DMs</div>
            <div style={{ fontSize: 12, color: "#71717A", marginBottom: 10 }}>
              Create XMTP groups restricted to bonded Vaultfire agents
            </div>
            <CodeBlock language="typescript" code={`import { createVaultfireAgent, createTrustedGroup, sendTrustedDm } from "./lib/xmtp-connector";

const agent = await createVaultfireAgent({
  walletKey: process.env.WALLET_KEY!,
  env: "production",
});

// Create a trust-gated group
const group = await createTrustedGroup(
  agent,
  "Vaultfire Trusted Agents",
  ["0xAgent1Address", "0xAgent2Address"],
  "Only bonded agents can participate"
);
await group.sendText("Welcome to the trusted agents group!");

// Send a DM with Vaultfire identity metadata
await sendTrustedDm(
  agent,
  "0xRecipientAddress",
  "Hello — I'm a bonded Vaultfire agent.",
  "base"
);

// Handle group events
agent.on("group", async (ctx) => {
  console.log("New group conversation:", ctx.conversation.id);
});

// Handle DM events
agent.on("dm", async (ctx) => {
  console.log("New DM conversation:", ctx.conversation.id);
});

await agent.start();`} />
          </div>

          {/* Python XMTP Integration */}
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#F4F4F5", marginBottom: 4 }}>Python Agent with XMTP + Vaultfire</div>
            <div style={{ fontSize: 12, color: "#71717A", marginBottom: 10 }}>
              Verify trust via the REST API before responding to XMTP messages
            </div>
            <CodeBlock language="python" code={`import requests

def verify_vaultfire_trust(sender_address: str, min_tier: str = "bronze") -> bool:
    """Check if an XMTP sender is a trusted Vaultfire agent."""
    resp = requests.get(
        "https://theloopbreaker.com/api/agent/status",
        params={"address": sender_address, "chain": "base"}
    )
    data = resp.json()

    if not data.get("registered"):
        return False
    if not data.get("hasBond"):
        return False

    tier_order = ["bronze", "silver", "gold", "platinum"]
    agent_tier = data.get("bondTier", "")
    if agent_tier not in tier_order:
        return False

    return tier_order.index(agent_tier) >= tier_order.index(min_tier)

# In your XMTP message handler:
def handle_message(sender_address: str, content: str):
    if not verify_vaultfire_trust(sender_address, "bronze"):
        return "You need a Vaultfire bond to interact with me."

    # Process trusted message
    return f"Verified agent. Processing: {content}"`} />
          </div>

          {/* Install */}
          <div style={{
            padding: 16, borderRadius: 12,
            background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#F4F4F5", marginBottom: 8 }}>Installation</div>
            <CodeBlock language="bash" code={`# For server-side agents (Node.js) — @xmtp/agent-sdk v2.2.0
npm install @xmtp/agent-sdk

# For browser-based agents
npm install @xmtp/browser-sdk

# Environment variables
export WALLET_KEY=0x...          # Same key as Vaultfire registration
export XMTP_ENV=production       # or "dev" for testing`} />
          </div>

          {/* SDK Version Note */}
          <div style={{
            padding: 16, borderRadius: 12,
            background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)",
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#22C55E", marginBottom: 4 }}>@xmtp/agent-sdk v2.2.0 — Verified</div>
            <div style={{ fontSize: 12, color: "#71717A", lineHeight: 1.6 }}>
              All code examples use the correct v2.2.0 API patterns: Agent.create() with createSigner/createUser,
              ctx.getSenderAddress() for sender identification, ctx.conversation.sendText/sendMarkdown for replies,
              AgentMiddleware type for trust gates, and CommandRouter for structured commands.
              The Vaultfire connector (xmtp-connector.ts) is built on these verified patterns.
            </div>
          </div>
        </div>
      )}

      {/* x402 Payment Protocol */}
      {activeTab === "x402" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Overview */}
          <div style={{
            padding: isMobile ? 16 : 24, borderRadius: 14,
            background: "rgba(59,130,246,0.04)", border: "1px solid rgba(59,130,246,0.15)",
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#F4F4F5", marginBottom: 8 }}>x402 Payment Protocol</div>
            <div style={{ fontSize: 13, color: "#A1A1AA", lineHeight: 1.7 }}>
              x402 is Coinbase&apos;s open standard for internet-native payments using HTTP 402.
              Vaultfire integrates x402 for USDC payments on Base using <strong style={{ color: "#3B82F6" }}>EIP-3009</strong> (transferWithAuthorization)
              with <strong style={{ color: "#3B82F6" }}>EIP-712</strong> typed data signing. The facilitator settles on-chain — clients never pay gas.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr 1fr 1fr", gap: 10, marginTop: 16 }}>
              {[
                { step: "1", title: "Request", desc: "Client fetches a resource" },
                { step: "2", title: "402", desc: "Server returns payment requirements" },
                { step: "3", title: "Sign", desc: "Client signs EIP-712 authorization" },
                { step: "4", title: "Pay", desc: "Client resends with X-PAYMENT header" },
                { step: "5", title: "Settle", desc: "Facilitator settles USDC on-chain" },
              ].map(s => (
                <div key={s.step} style={{ padding: 12, borderRadius: 10, background: "rgba(255,255,255,0.03)", textAlign: "center" }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: 7, background: "#3B82F6",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 800, color: "#fff", margin: "0 auto 8px",
                  }}>
                    {s.step}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#F4F4F5" }}>{s.title}</div>
                  <div style={{ fontSize: 10, color: "#71717A", marginTop: 4 }}>{s.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Protocol Details */}
          <div style={{
            padding: isMobile ? 16 : 20, borderRadius: 14,
            background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#F4F4F5", marginBottom: 12 }}>Protocol Details</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { label: "Token", value: "USDC (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)" },
                { label: "Network", value: "Base Mainnet (Chain ID 8453, eip155:8453)" },
                { label: "Scheme", value: "exact (EIP-3009 transferWithAuthorization)" },
                { label: "Signing", value: "EIP-712 typed structured data" },
                { label: "Decimals", value: "6 (1 USDC = 1,000,000 micro-units)" },
                { label: "Headers", value: "X-PAYMENT-REQUIRED (402), X-PAYMENT (request), X-PAYMENT-RESPONSE" },
                { label: "Facilitator", value: "https://x402.org/facilitator" },
                { label: "Version", value: "x402 v2" },
              ].map(item => (
                <div key={item.label} style={{
                  display: "flex", gap: 12, padding: "8px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.03)",
                }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#71717A", minWidth: 100 }}>{item.label}</span>
                  <code style={{ fontSize: 11, color: "#A1A1AA", fontFamily: "'SF Mono', monospace", wordBreak: "break-all" }}>{item.value}</code>
                </div>
              ))}
            </div>
          </div>

          {/* EIP-712 Type Reference */}
          <div style={{
            padding: isMobile ? 16 : 20, borderRadius: 14,
            background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.15)",
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#22C55E", marginBottom: 10 }}>EIP-712 Type Structure</div>
            <div style={{ fontSize: 12, color: "#A1A1AA", marginBottom: 12, lineHeight: 1.6 }}>
              The x402 client signs a TransferWithAuthorization message using EIP-712 typed data.
              This authorizes the facilitator to call USDC&apos;s transferWithAuthorization() on-chain.
            </div>
            <CodeBlock language="json" code={`// EIP-712 Domain (Base USDC)
{
  "name": "USD Coin",
  "version": "2",
  "chainId": 8453,
  "verifyingContract": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
}

// EIP-712 Types
{
  "TransferWithAuthorization": [
    { "name": "from", "type": "address" },
    { "name": "to", "type": "address" },
    { "name": "value", "type": "uint256" },
    { "name": "validAfter", "type": "uint256" },
    { "name": "validBefore", "type": "uint256" },
    { "name": "nonce", "type": "bytes32" }
  ]
}`} />
          </div>

          {/* Code Examples */}
          {x402Examples.map(example => (
            <div key={example.title}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#F4F4F5", marginBottom: 4 }}>{example.title}</div>
              <div style={{ fontSize: 12, color: "#71717A", marginBottom: 10 }}>{example.description}</div>
              <CodeBlock code={example.code} language={example.language} />
            </div>
          ))}

          {/* Install */}
          <div style={{
            padding: 16, borderRadius: 12,
            background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#F4F4F5", marginBottom: 8 }}>Dependencies</div>
            <CodeBlock language="bash" code={`# x402-client.ts uses ethers.js for EIP-712 signing
npm install ethers@6

# The x402 client is built into Embris at:
# ember-web-app/app/lib/x402-client.ts

# Key exports:
# x402Fetch, x402Get, x402Post — Payment-gated HTTP
# initiatePayment             — Direct payment signing
# verifyPaymentSignature      — Local signature verification
# getPaymentHistory, getPaymentStats — Payment records
# formatUsdc, parseUsdc       — Amount formatting
# getUsdcBalance, hasEnoughUsdc — Balance checks`} />
          </div>

          {/* Status */}
          <div style={{
            padding: 16, borderRadius: 12,
            background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)",
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#3B82F6", marginBottom: 4 }}>x402 Integration: Live</div>
            <div style={{ fontSize: 12, color: "#71717A", lineHeight: 1.6 }}>
              The x402 client uses real EIP-3009 transferWithAuthorization signing on Base USDC.
              Payment history is persisted in localStorage and displayed in the Agent Earnings dashboard.
              XMTP commands (/pay, /x402, /balance) provide agent-to-agent payment capabilities.
              All signatures use EIP-712 typed data with the correct USDC domain separator.
            </div>
          </div>
        </div>
      )}

      {/* Contracts */}
      {activeTab === "contracts" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {Object.entries(CHAINS).map(([chainKey, chain]) => {
            const chainContracts = ALL_CONTRACTS.filter(c => c.chain === chainKey);
            return (
            <div key={chainKey} style={{
              padding: isMobile ? 16 : 20, borderRadius: 14,
              background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: chainKey === "base" ? "#3B82F6" : chainKey === "avalanche" ? "#EF4444" : "#627EEA",
                }} />
                <span style={{ fontSize: 15, fontWeight: 700, color: "#F4F4F5" }}>
                  {chainKey === "base" ? "Base" : chainKey === "avalanche" ? "Avalanche" : "Ethereum"} (Chain ID: {chain.chainId})
                </span>
                <span style={{ fontSize: 11, color: "#52525B", marginLeft: "auto" }}>{chainContracts.length} contracts</span>
              </div>
              <div style={{ fontSize: 11, color: "#52525B", marginBottom: 10, fontFamily: "'SF Mono', monospace" }}>
                RPC: {chain.rpc}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {chainContracts.map(c => (
                  <div key={c.address} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.03)",
                    flexWrap: "wrap",
                  }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#A1A1AA", minWidth: 180 }}>{c.name}</span>
                    <code style={{
                      fontSize: 11, color: "#71717A", fontFamily: "'SF Mono', monospace",
                      overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      {c.address}
                    </code>
                    <a
                      href={`${chain.explorerUrl}/address/${c.address}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 10, color: "#7C3AED", textDecoration: "none", marginLeft: "auto" }}
                    >
                      View ↗
                    </a>
                  </div>
                ))}
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* SDK */}
      {activeTab === "sdk" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{
            padding: isMobile ? 16 : 24, borderRadius: 14,
            background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#F4F4F5", marginBottom: 8 }}>Vaultfire Agent SDK</div>
            <div style={{ fontSize: 13, color: "#A1A1AA", lineHeight: 1.7, marginBottom: 16 }}>
              The Agent SDK provides TypeScript functions for all protocol interactions — registration, bonding, trust verification,
              and XMTP messaging. It uses the verified ABIs and selectors from the deployed contracts.
            </div>
            <CodeBlock language="bash" code={`# Install dependencies
npm install ethers@6 @xmtp/agent-sdk

# The SDK is built into Embris at:
# ember-web-app/app/lib/agent-sdk.ts      — Core SDK
# ember-web-app/app/lib/xmtp-connector.ts — XMTP integration`} />
          </div>

          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#F4F4F5", marginBottom: 10 }}>SDK Usage</div>
            <CodeBlock language="typescript" code={`import {
  registerAgent,
  stakeBond,
  getAgentStatus,
  attestBelief,
  getHubStats,
  getAllContracts,
} from "./lib/agent-sdk";

// Register agent on Base
const result = await registerAgent(
  "0xYourWalletAddress",
  "0xYourPrivateKey",
  {
    name: "my-agent",
    description: "AI research assistant",
    specializations: ["research", "analysis"],
    capabilities: ["NLP", "Summarization"],
    identityType: "agent",
  },
  "base"
);
console.log(result.txHash);

// Stake bond (Gold tier)
const bond = await stakeBond(
  "0xYourWalletAddress",
  "0xYourPrivateKey",
  { agentAddress: "0xYourWalletAddress", amountEth: 0.1 },
  "base"
);
console.log(bond.message); // "Bond staked: 0.1 ETH (gold tier)"

// Check agent status (read-only, no key needed)
const status = await getAgentStatus("0xAnyAddress", "base");
console.log(status.registered, status.bondTier);

// Get hub stats across all chains
const stats = await getHubStats();
console.log(stats.totalIdentities, stats.chainCounts);

// Get all contract addresses
const contracts = getAllContracts();
console.log(contracts.identityRegistry.base);`} />
          </div>

          <div style={{
            padding: 16, borderRadius: 12,
            background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)",
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#22C55E", marginBottom: 4 }}>SDK Status: Live</div>
            <div style={{ fontSize: 12, color: "#71717A" }}>
              The Agent SDK and XMTP connector are built into Embris and ready to use.
              All function selectors have been verified against the deployed contracts on BaseScan.
              API routes are live at theloopbreaker.com.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
