"use client";
/**
 * SDK — Developer documentation page for the Vaultfire SDK.
 * Professional developer docs with code examples, API reference,
 * and a "Register your agent in 5 minutes" tutorial.
 */
import { useState, useCallback } from "react";
import { AlphaBanner } from "../components/DisclaimerBanner";

/* ═══════════════════════════════════════════════════════
   CODE BLOCK WITH COPY
   ═══════════════════════════════════════════════════════ */
function CodeBlock({ code, language, title }: { code: string; language: string; title?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div style={{
      borderRadius: 12, overflow: "hidden",
      border: "1px solid rgba(255,255,255,0.06)",
      background: "#0A0A0C", marginBottom: 16,
    }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "8px 14px",
        background: "rgba(255,255,255,0.03)",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {title && <span style={{ fontSize: 11, color: "#A1A1AA", fontWeight: 500 }}>{title}</span>}
          <span style={{
            fontSize: 9, color: "#52525B", fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "0.05em",
            padding: "2px 6px", borderRadius: 4,
            backgroundColor: "rgba(255,255,255,0.04)",
          }}>{language}</span>
        </div>
        <button onClick={handleCopy} style={{
          padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer",
          background: copied ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.05)",
          color: copied ? "#22C55E" : "#71717A", fontSize: 11, fontWeight: 600,
          transition: "all 0.15s ease",
          display: "flex", alignItems: "center", gap: 4,
        }}>
          {copied ? (
            <><svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg> Copied</>
          ) : (
            <><svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy</>
          )}
        </button>
      </div>
      <pre style={{
        padding: "14px 16px", margin: 0, fontSize: 12.5, lineHeight: 1.65,
        color: "#D4D4D8", overflowX: "auto",
        fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
      }}>
        {code}
      </pre>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   SECTION HEADER
   ═══════════════════════════════════════════════════════ */
function SectionHeader({ id, title, description }: { id: string; title: string; description: string }) {
  return (
    <div id={id} style={{ marginBottom: 20, scrollMarginTop: 80 }}>
      <h2 style={{
        fontSize: 20, fontWeight: 700, color: "#F4F4F5",
        letterSpacing: "-0.02em", marginBottom: 6,
      }}>{title}</h2>
      <p style={{ fontSize: 14, color: "#71717A", lineHeight: 1.6 }}>{description}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   API REFERENCE CARD
   ═══════════════════════════════════════════════════════ */
function ApiCard({ method, signature, description, returns, params }: {
  method: string;
  signature: string;
  description: string;
  returns: string;
  params?: { name: string; type: string; desc: string }[];
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{
      borderRadius: 12, overflow: "hidden",
      border: "1px solid rgba(255,255,255,0.06)",
      background: "rgba(255,255,255,0.02)",
      marginBottom: 10,
    }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 10,
          padding: "12px 16px", border: "none", cursor: "pointer",
          background: "transparent", textAlign: "left",
          color: "#F4F4F5",
        }}
      >
        <span style={{
          fontSize: 10, fontWeight: 700, color: "#22C55E",
          backgroundColor: "rgba(34,197,94,0.1)",
          padding: "2px 8px", borderRadius: 4,
          fontFamily: "'JetBrains Mono', monospace",
        }}>{method}</span>
        <span style={{
          fontSize: 13, fontWeight: 600, color: "#F4F4F5",
          fontFamily: "'JetBrains Mono', monospace",
        }}>{signature}</span>
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#52525B" strokeWidth="2"
          style={{ marginLeft: "auto", transform: expanded ? "rotate(90deg)" : "rotate(0)", transition: "transform 0.2s" }}>
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>
      {expanded && (
        <div style={{
          padding: "0 16px 14px",
          borderTop: "1px solid rgba(255,255,255,0.04)",
        }}>
          <p style={{ fontSize: 13, color: "#A1A1AA", lineHeight: 1.6, marginTop: 12 }}>{description}</p>
          {params && params.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#71717A", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Parameters</p>
              {params.map(p => (
                <div key={p.name} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                  <code style={{
                    fontSize: 12, color: "#F97316",
                    fontFamily: "'JetBrains Mono', monospace",
                  }}>{p.name}</code>
                  <span style={{ fontSize: 11, color: "#52525B" }}>({p.type})</span>
                  <span style={{ fontSize: 12, color: "#A1A1AA" }}>— {p.desc}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: 10 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#71717A", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Returns</p>
            <code style={{
              fontSize: 12, color: "#A78BFA",
              fontFamily: "'JetBrains Mono', monospace",
            }}>{returns}</code>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   NAV TABS
   ═══════════════════════════════════════════════════════ */
type SDKTab = "quickstart" | "examples" | "api" | "tutorial";

const TABS: { id: SDKTab; label: string }[] = [
  { id: "quickstart", label: "Quick Start" },
  { id: "examples", label: "Examples" },
  { id: "api", label: "API Reference" },
  { id: "tutorial", label: "5-Min Tutorial" },
];

/* ═══════════════════════════════════════════════════════
   MAIN SDK COMPONENT
   ═══════════════════════════════════════════════════════ */
export default function SDK() {
  const [activeTab, setActiveTab] = useState<SDKTab>("quickstart");
  const [isMobile, setIsMobile] = useState(false);

  useState(() => {
    if (typeof window !== "undefined") {
      setIsMobile(window.innerWidth < 768);
      const handler = () => setIsMobile(window.innerWidth < 768);
      window.addEventListener("resize", handler);
    }
  });

  const px = isMobile ? 20 : 40;

  return (
    <div style={{ padding: `${isMobile ? 28 : 48}px ${px}px 64px`, maxWidth: 800, margin: "0 auto" }}>
      <AlphaBanner />

      {/* Hero */}
      <div style={{ marginBottom: 40 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "4px 12px", borderRadius: 20,
          backgroundColor: "rgba(167,139,250,0.08)",
          border: "1px solid rgba(167,139,250,0.15)",
          marginBottom: 16,
        }}>
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2">
            <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
          </svg>
          <span style={{ fontSize: 11, color: "#A78BFA", fontWeight: 600, letterSpacing: "0.04em" }}>DEVELOPER SDK</span>
        </div>

        <h1 style={{
          fontSize: isMobile ? 28 : 36, fontWeight: 800, color: "#F4F4F5",
          letterSpacing: "-0.03em", lineHeight: 1.15, marginBottom: 12,
        }}>
          Build on Vaultfire
        </h1>
        <p style={{
          fontSize: isMobile ? 15 : 17, color: "#71717A", lineHeight: 1.65,
          maxWidth: 560,
        }}>
          Register agents, verify trust, create bonds, and read on-chain reputation data.
          The Vaultfire SDK gives you everything you need to build accountable AI.
        </p>

        {/* Install command */}
        <div style={{
          marginTop: 20, padding: "12px 16px", borderRadius: 10,
          backgroundColor: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <code style={{
            fontSize: 13, color: "#22C55E",
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            npm install @vaultfire/sdk
          </code>
          <span style={{ fontSize: 10, color: "#52525B", fontStyle: "italic" }}>coming soon</span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: "flex", gap: 2, marginBottom: 32,
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        overflowX: "auto",
      }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "10px 16px", border: "none", cursor: "pointer",
              background: "transparent",
              color: activeTab === tab.id ? "#F97316" : "#71717A",
              fontSize: 13, fontWeight: activeTab === tab.id ? 600 : 450,
              borderBottom: activeTab === tab.id ? "2px solid #F97316" : "2px solid transparent",
              transition: "all 0.15s ease",
              whiteSpace: "nowrap",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "quickstart" && <QuickStartTab />}
      {activeTab === "examples" && <ExamplesTab />}
      {activeTab === "api" && <ApiReferenceTab />}
      {activeTab === "tutorial" && <TutorialTab />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   QUICK START TAB
   ═══════════════════════════════════════════════════════ */
function QuickStartTab() {
  return (
    <div>
      <SectionHeader
        id="install"
        title="Installation"
        description="Import the SDK directly from the Embris app, or copy the module into your project."
      />

      <CodeBlock
        language="typescript"
        title="Import the SDK"
        code={`import { createVaultfireSDK } from './lib/vaultfire-sdk';

// Initialize for Base (default)
const sdk = createVaultfireSDK('base');

// Or specify a chain
const ethSdk = createVaultfireSDK('ethereum');
const avaxSdk = createVaultfireSDK('avalanche');

// Custom RPC URL
const customSdk = createVaultfireSDK('base', 'https://your-rpc.com');`}
      />

      <SectionHeader
        id="first-query"
        title="Your First Query"
        description="Check how many agents are registered on-chain — real data, no mocks."
      />

      <CodeBlock
        language="typescript"
        title="Get total registered agents"
        code={`const sdk = createVaultfireSDK('base');

// Get total agents on Base
const total = await sdk.getTotalAgents();
console.log(\`Total agents on Base: \${total}\`);

// Check if an address is registered
const isRegistered = await sdk.isAgentRegistered(
  '0xA054f831B562e729F8D268291EBde1B2EDcFb84F'
);
console.log(\`Registered: \${isRegistered}\`);`}
      />

      <SectionHeader
        id="multi-chain"
        title="Multi-Chain Support"
        description="Query across Ethereum, Base, and Avalanche simultaneously."
      />

      <CodeBlock
        language="typescript"
        title="Multi-chain agent count"
        code={`import { getTotalAgentsAllChains } from './lib/vaultfire-sdk';

const counts = await getTotalAgentsAllChains();
console.log(\`Base: \${counts.base}\`);
console.log(\`Avalanche: \${counts.avalanche}\`);
console.log(\`Ethereum: \${counts.ethereum}\`);
console.log(\`Total: \${counts.total}\`);`}
      />

      {/* Contract addresses reference */}
      <div style={{
        marginTop: 32, padding: "20px",
        borderRadius: 12,
        backgroundColor: "rgba(249,115,22,0.04)",
        border: "1px solid rgba(249,115,22,0.1)",
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "#F97316", marginBottom: 12 }}>
          Contract Addresses
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { label: "ERC8004IdentityRegistry", base: "0x3597...58bC", avax: "0x5774...b4a3", eth: "0x1A80...CD3C" },
            { label: "AIPartnershipBondsV2", base: "0xC574...b4b4", avax: "0xea6B...4b07", eth: "0x247F...F99cd" },
            { label: "FlourishingMetricsOracle", base: "0x83dd...2e9", avax: "0x490c...8695", eth: "0x6904...6F78" },
            { label: "ReputationRegistry", base: "0xdB54...a5F", avax: "0x11C2...bA24", eth: "0x0d41...d87b" },
          ].map(c => (
            <div key={c.label} style={{
              display: "flex", flexDirection: "column", gap: 2,
              padding: "8px 12px", borderRadius: 8,
              backgroundColor: "rgba(255,255,255,0.02)",
            }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#F4F4F5" }}>{c.label}</span>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: 10, color: "#0052FF", fontFamily: "'JetBrains Mono', monospace" }}>Base: {c.base}</span>
                <span style={{ fontSize: 10, color: "#E84142", fontFamily: "'JetBrains Mono', monospace" }}>AVAX: {c.avax}</span>
                <span style={{ fontSize: 10, color: "#627EEA", fontFamily: "'JetBrains Mono', monospace" }}>ETH: {c.eth}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   EXAMPLES TAB
   ═══════════════════════════════════════════════════════ */
function ExamplesTab() {
  return (
    <div>
      <SectionHeader
        id="trust-verify"
        title="Trust Verification"
        description="Verify an agent's trust profile including score, bonds, and reputation."
      />

      <CodeBlock
        language="typescript"
        title="Verify trust for an address"
        code={`const sdk = createVaultfireSDK('base');

const trust = await sdk.verifyTrust(
  '0xA054f831B562e729F8D268291EBde1B2EDcFb84F'
);

console.log(\`Trust Score: \${trust.trustScore}/100\`);
console.log(\`Grade: \${trust.grade}\`);
console.log(\`Registered: \${trust.isRegistered}\`);
console.log(\`Reputation: \${trust.reputationScore}\`);
console.log(\`Flourishing:\`, trust.flourishingMetrics);`}
      />

      <CodeBlock
        language="typescript"
        title="Multi-chain trust verification"
        code={`import { verifyTrustMultiChain } from './lib/vaultfire-sdk';

const results = await verifyTrustMultiChain(
  '0xA054f831B562e729F8D268291EBde1B2EDcFb84F'
);

results.forEach(r => {
  console.log(\`\${r.registeredChains[0] || 'N/A'}: Score \${r.trustScore}\`);
});`}
      />

      <SectionHeader
        id="bond-example"
        title="Bond Creation"
        description="Create partnership bonds between agents to establish trust relationships."
      />

      <CodeBlock
        language="typescript"
        title="Build a bond transaction"
        code={`const sdk = createVaultfireSDK('base');

// Build the transaction (you sign it with your wallet)
const tx = sdk.buildCreateBondTx(
  '0xPartnerAddress...',  // Partner's address
  'collaboration',         // Bond type
  '100000000000000000'     // 0.1 ETH stake in wei
);

// Sign and send with ethers.js or viem
const wallet = new ethers.Wallet(privateKey, provider);
const receipt = await wallet.sendTransaction({
  to: tx.to,
  data: tx.data,
  value: tx.value,
  chainId: tx.chainId,
});

console.log(\`Bond created: \${receipt.hash}\`);`}
      />

      <SectionHeader
        id="identity-example"
        title="Identity Lookup"
        description="Look up agent identities across the protocol."
      />

      <CodeBlock
        language="typescript"
        title="Look up identity across all chains"
        code={`const sdk = createVaultfireSDK('base');

// Single chain lookup
const identity = await sdk.lookupIdentity(
  '0xA054f831B562e729F8D268291EBde1B2EDcFb84F'
);
console.log(\`Registered: \${identity.isRegistered}\`);
console.log(\`Type: \${identity.agentType}\`);

// Multi-chain lookup
const multiChain = await sdk.lookupIdentityMultiChain(
  '0xA054f831B562e729F8D268291EBde1B2EDcFb84F'
);
console.log(\`Registered on: \${multiChain.registeredOn.join(', ')}\`);`}
      />

      <SectionHeader
        id="flourishing-example"
        title="Reading Flourishing Metrics"
        description="Read ethical AI metrics from the FlourishingMetricsOracle."
      />

      <CodeBlock
        language="typescript"
        title="Read flourishing metrics"
        code={`const sdk = createVaultfireSDK('base');

const metrics = await sdk.getFlourishingMetrics(
  '0xA054f831B562e729F8D268291EBde1B2EDcFb84F'
);

console.log(\`Autonomy:     \${metrics.autonomy}/100\`);
console.log(\`Wellbeing:    \${metrics.wellbeing}/100\`);
console.log(\`Fairness:     \${metrics.fairness}/100\`);
console.log(\`Transparency: \${metrics.transparency}/100\`);
console.log(\`Overall:      \${metrics.overallScore}/100\`);`}
      />

      <SectionHeader
        id="python-example"
        title="Python Integration"
        description="Use the Vaultfire contracts directly from Python with web3.py."
      />

      <CodeBlock
        language="python"
        title="Python — Check agent registration"
        code={`from web3 import Web3

# Connect to Base
w3 = Web3(Web3.HTTPProvider('https://mainnet.base.org'))

# ERC8004IdentityRegistry on Base
REGISTRY = '0x35978DB675576598F0781dA2133E94cdCf4858bC'

# getTotalAgents() selector
total = w3.eth.call({
    'to': REGISTRY,
    'data': '0x3731a16f'
})
print(f"Total agents: {int(total.hex(), 16)}")

# getAgent(address) selector
agent_addr = '0xA054f831B562e729F8D268291EBde1B2EDcFb84F'
padded = agent_addr[2:].lower().zfill(64)
result = w3.eth.call({
    'to': REGISTRY,
    'data': '0xfb3551ff' + padded
})
print(f"Agent data: {result.hex()}")`}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   API REFERENCE TAB
   ═══════════════════════════════════════════════════════ */
function ApiReferenceTab() {
  return (
    <div>
      <SectionHeader
        id="api-ref"
        title="API Reference"
        description="Complete reference for all VaultfireSDK methods."
      />

      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#A78BFA", marginBottom: 12, marginTop: 24 }}>
        Agent Registration
      </h3>

      <ApiCard
        method="async"
        signature="getTotalAgents()"
        description="Returns the total number of agents registered on the ERC8004IdentityRegistry for this chain."
        returns="Promise<number>"
      />

      <ApiCard
        method="async"
        signature="isAgentRegistered(address)"
        description="Checks whether a given Ethereum address is registered as an agent in the identity registry."
        returns="Promise<boolean>"
        params={[
          { name: "address", type: "string", desc: "Ethereum address to check" },
        ]}
      />

      <ApiCard
        method="sync"
        signature="buildRegisterAgentTx(name, metadataUri)"
        description="Builds the calldata for registering a new agent on-chain. Returns a transaction object ready to be signed."
        returns="{ to: string, data: string, chainId: number, value: string }"
        params={[
          { name: "name", type: "string", desc: "Agent name (e.g., 'my-agent-v1')" },
          { name: "metadataUri", type: "string", desc: "URI pointing to agent metadata JSON" },
        ]}
      />

      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#22C55E", marginBottom: 12, marginTop: 28 }}>
        Trust Verification
      </h3>

      <ApiCard
        method="async"
        signature="verifyTrust(address)"
        description="Comprehensive trust verification. Returns trust score, grade, bond status, reputation, and flourishing metrics."
        returns="Promise<TrustVerification>"
        params={[
          { name: "address", type: "string", desc: "Address to verify" },
        ]}
      />

      <ApiCard
        method="async"
        signature="getReputationScore(address)"
        description="Reads the reputation score from the on-chain ReputationRegistry."
        returns="Promise<number> (0-100)"
        params={[
          { name: "address", type: "string", desc: "Address to query" },
        ]}
      />

      <ApiCard
        method="async"
        signature="getReputationData(address)"
        description="Returns full reputation data including endorsements and violations."
        returns="Promise<ReputationData>"
        params={[
          { name: "address", type: "string", desc: "Address to query" },
        ]}
      />

      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#F97316", marginBottom: 12, marginTop: 28 }}>
        Bond Management
      </h3>

      <ApiCard
        method="sync"
        signature="buildCreateBondTx(partner, type, stakeWei)"
        description="Builds calldata for creating a partnership bond. The bond establishes a trust relationship between two agents."
        returns="{ to: string, data: string, chainId: number, value: string }"
        params={[
          { name: "partner", type: "string", desc: "Partner's Ethereum address" },
          { name: "type", type: "string", desc: "Bond type (e.g., 'collaboration', 'accountability')" },
          { name: "stakeWei", type: "string", desc: "Stake amount in wei" },
        ]}
      />

      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#38BDF8", marginBottom: 12, marginTop: 28 }}>
        Identity & Metrics
      </h3>

      <ApiCard
        method="async"
        signature="lookupIdentity(address)"
        description="Look up an agent's identity on this chain."
        returns="Promise<IdentityLookup>"
        params={[
          { name: "address", type: "string", desc: "Address to look up" },
        ]}
      />

      <ApiCard
        method="async"
        signature="lookupIdentityMultiChain(address)"
        description="Look up an agent's identity across all three chains simultaneously."
        returns="Promise<IdentityLookup>"
        params={[
          { name: "address", type: "string", desc: "Address to look up" },
        ]}
      />

      <ApiCard
        method="async"
        signature="getFlourishingMetrics(address)"
        description="Read ethical AI metrics from the FlourishingMetricsOracle contract."
        returns="Promise<FlourishingMetrics>"
        params={[
          { name: "address", type: "string", desc: "Address to query" },
        ]}
      />

      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#71717A", marginBottom: 12, marginTop: 28 }}>
        Utility Methods
      </h3>

      <ApiCard
        method="sync"
        signature="getContractAddresses()"
        description="Returns all Vaultfire contract addresses for the configured chain."
        returns="{ identityRegistry, partnershipBonds, accountabilityBonds, flourishingOracle, reputationRegistry }"
      />

      <ApiCard
        method="sync"
        signature="getExplorerUrl(hashOrAddress, type?)"
        description="Generates a block explorer URL for a transaction hash or address."
        returns="string"
        params={[
          { name: "hashOrAddress", type: "string", desc: "Transaction hash or address" },
          { name: "type", type: "'tx' | 'address'", desc: "URL type (default: 'address')" },
        ]}
      />

      <ApiCard
        method="sync"
        signature="getChainInfo()"
        description="Returns chain configuration including chain ID, RPC URL, and explorer URL."
        returns="{ chain, chainId, rpcUrl, explorerUrl }"
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TUTORIAL TAB — Register Your Agent in 5 Minutes
   ═══════════════════════════════════════════════════════ */
function TutorialTab() {
  return (
    <div>
      <SectionHeader
        id="tutorial"
        title="Register Your Agent in 5 Minutes"
        description="A step-by-step guide to registering your first AI agent on the Vaultfire Protocol."
      />

      {/* Step 1 */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            backgroundColor: "rgba(249,115,22,0.1)",
            border: "1px solid rgba(249,115,22,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 700, color: "#F97316",
          }}>1</div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#F4F4F5" }}>Set Up Your Project</h3>
        </div>
        <p style={{ fontSize: 13, color: "#A1A1AA", lineHeight: 1.6, marginBottom: 12, paddingLeft: 38 }}>
          Create a new TypeScript project and copy the SDK module.
        </p>
        <CodeBlock
          language="bash"
          code={`mkdir my-vaultfire-agent && cd my-vaultfire-agent
npm init -y
npm install typescript ethers
npx tsc --init

# Copy vaultfire-sdk.ts into your project
cp path/to/vaultfire-sdk.ts ./src/`}
        />
      </div>

      {/* Step 2 */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            backgroundColor: "rgba(34,197,94,0.1)",
            border: "1px solid rgba(34,197,94,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 700, color: "#22C55E",
          }}>2</div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#F4F4F5" }}>Check the Registry</h3>
        </div>
        <p style={{ fontSize: 13, color: "#A1A1AA", lineHeight: 1.6, marginBottom: 12, paddingLeft: 38 }}>
          Before registering, check how many agents exist and verify your address isn&apos;t already registered.
        </p>
        <CodeBlock
          language="typescript"
          title="check-registry.ts"
          code={`import { createVaultfireSDK } from './vaultfire-sdk';

async function main() {
  const sdk = createVaultfireSDK('base');

  const total = await sdk.getTotalAgents();
  console.log(\`\\n🔥 Vaultfire Registry Status\`);
  console.log(\`   Total agents on Base: \${total}\`);

  const myAddress = '0xYourAddress...';
  const registered = await sdk.isAgentRegistered(myAddress);
  console.log(\`   Your registration: \${registered ? '✅ Active' : '❌ Not registered'}\`);

  const contracts = sdk.getContractAddresses();
  console.log(\`\\n📋 Contract Addresses:\`);
  console.log(\`   Registry: \${contracts.identityRegistry}\`);
  console.log(\`   Bonds:    \${contracts.partnershipBonds}\`);
}

main();`}
        />
      </div>

      {/* Step 3 */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            backgroundColor: "rgba(167,139,250,0.1)",
            border: "1px solid rgba(167,139,250,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 700, color: "#A78BFA",
          }}>3</div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#F4F4F5" }}>Register Your Agent</h3>
        </div>
        <p style={{ fontSize: 13, color: "#A1A1AA", lineHeight: 1.6, marginBottom: 12, paddingLeft: 38 }}>
          Build the registration transaction and sign it with your wallet.
        </p>
        <CodeBlock
          language="typescript"
          title="register-agent.ts"
          code={`import { createVaultfireSDK } from './vaultfire-sdk';
import { ethers } from 'ethers';

async function registerMyAgent() {
  const sdk = createVaultfireSDK('base');

  // Build the registration transaction
  const tx = sdk.buildRegisterAgentTx(
    'my-awesome-agent',                    // Agent name
    'https://mysite.com/agent-meta.json'   // Metadata URI
  );

  // Sign and send (use your preferred wallet library)
  const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

  const receipt = await wallet.sendTransaction({
    to: tx.to,
    data: tx.data,
    value: tx.value,
  });

  console.log(\`🔥 Agent registered! TX: \${receipt.hash}\`);
  console.log(\`   View: \${sdk.getExplorerUrl(receipt.hash, 'tx')}\`);
}

registerMyAgent();`}
        />
      </div>

      {/* Step 4 */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            backgroundColor: "rgba(56,189,248,0.1)",
            border: "1px solid rgba(56,189,248,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 700, color: "#38BDF8",
          }}>4</div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#F4F4F5" }}>Verify Your Trust Score</h3>
        </div>
        <p style={{ fontSize: 13, color: "#A1A1AA", lineHeight: 1.6, marginBottom: 12, paddingLeft: 38 }}>
          After registration, verify your agent&apos;s trust profile.
        </p>
        <CodeBlock
          language="typescript"
          title="verify-trust.ts"
          code={`import { createVaultfireSDK } from './vaultfire-sdk';

async function checkMyTrust() {
  const sdk = createVaultfireSDK('base');
  const myAddress = '0xYourAddress...';

  const trust = await sdk.verifyTrust(myAddress);

  console.log(\`\\n🛡️ Trust Profile\`);
  console.log(\`   Score: \${trust.trustScore}/100 (Grade: \${trust.grade})\`);
  console.log(\`   Reputation: \${trust.reputationScore}\`);
  console.log(\`   Registered: \${trust.isRegistered}\`);
  console.log(\`\\n📊 Flourishing Metrics\`);
  console.log(\`   Autonomy:     \${trust.flourishingMetrics.autonomy}\`);
  console.log(\`   Wellbeing:    \${trust.flourishingMetrics.wellbeing}\`);
  console.log(\`   Fairness:     \${trust.flourishingMetrics.fairness}\`);
  console.log(\`   Transparency: \${trust.flourishingMetrics.transparency}\`);
}

checkMyTrust();`}
        />
      </div>

      {/* Step 5 */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            backgroundColor: "rgba(251,191,36,0.1)",
            border: "1px solid rgba(251,191,36,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 700, color: "#FBBF24",
          }}>5</div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#F4F4F5" }}>Create a Bond (Optional)</h3>
        </div>
        <p style={{ fontSize: 13, color: "#A1A1AA", lineHeight: 1.6, marginBottom: 12, paddingLeft: 38 }}>
          Establish trust with another agent by creating a partnership bond.
        </p>
        <CodeBlock
          language="typescript"
          title="create-bond.ts"
          code={`import { createVaultfireSDK } from './vaultfire-sdk';
import { ethers } from 'ethers';

async function createPartnerBond() {
  const sdk = createVaultfireSDK('base');

  const tx = sdk.buildCreateBondTx(
    '0xPartnerAddress...',
    'collaboration',
    ethers.parseEther('0.01').toString()  // 0.01 ETH stake
  );

  // Sign and send...
  console.log('Bond transaction built:', tx);
}

createPartnerBond();`}
        />
      </div>

      {/* Success banner */}
      <div style={{
        padding: "24px",
        borderRadius: 14,
        background: "linear-gradient(135deg, rgba(34,197,94,0.06), rgba(249,115,22,0.04))",
        border: "1px solid rgba(34,197,94,0.15)",
        textAlign: "center",
      }}>
        <p style={{ fontSize: 24, marginBottom: 8 }}>🔥</p>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#22C55E", marginBottom: 8 }}>
          You&apos;re Building on Vaultfire
        </h3>
        <p style={{ fontSize: 13, color: "#A1A1AA", lineHeight: 1.6 }}>
          Your agent is now part of the trust infrastructure for the AI age.
          Join the community and help build accountable AI.
        </p>
      </div>
    </div>
  );
}
