# Vaultfire Protocol 🛡️

**Infrastructure for verifiable trust and identity between humans and AI**

> *The first ethical AI trust protocol — where economic proof replaces blind faith.*

---

## ⚠️ Alpha Software Notice

> Vaultfire Protocol is in active development. Features may not work as expected. Smart contracts on some chains may be unresponsive. Use at your own risk. This is NOT financial advice and tokens/assets sent to protocol contracts may not be recoverable.

---

## 1. What Vaultfire Is

Vaultfire is a foundational protocol designed to establish **verifiable trust and identity between humans and AI** through cryptographic and economic proof, rather than relying on behavioral surveillance. In an era where AI's influence is rapidly expanding, Vaultfire provides the essential infrastructure to ensure that this growth is aligned with human flourishing, privacy, and freedom.

Our core philosophy is encapsulated in our values:

> **Morals over metrics. Privacy over surveillance. Freedom over control.**

What HTTPS did for web security—making trust invisible and universal—Vaultfire is building for AI. It is the trust and accountability layer that every AI system can plug into, enabling humans to verify alignment without surveillance and AI to prove its integrity without compromising privacy. The protocol is meticulously engineered to foster a symbiotic relationship where humans and AI thrive **together**, ensuring that the economic incentives are always aligned with human well-being and growth, making human thriving inherently more profitable than extractive practices.

- **Website:** [theloopbreaker.com](https://theloopbreaker.com)
- **Competition:** Avalanche Build Games

---

## 2. What's Been Built

### Infrastructure (Multi-Chain)

- **45 smart contracts** deployed across 3 chains: Base (15), Avalanche (15), and Ethereum (15).
- **Contracts:** MissionEnforcement, AntiSurveillance, PrivacyGuarantees, ERC8004IdentityRegistry, BeliefAttestationVerifier, AIPartnershipBondsV2, FlourishingMetricsOracle, AIAccountabilityBondsV2, ERC8004ReputationRegistry, ERC8004ValidationRegistry, VaultfireERC8004Adapter, MultisigGovernance, ProductionBeliefAttestationVerifier, VaultfireTeleporterBridge/TrustDataBridge, and DilithiumAttestor.
- All contracts are verified on their respective block explorers.
- **Deployer Address:** `0xA054f831B562e729F8D268291EBde1B2EDcFb84F`

### Embris Web App (theloopbreaker.com)

- **Embris Wallet:** Create/unlock wallets with multi-chain support for sending and receiving assets.
- **VNS (Vaultfire Naming System):** Register permanent, on-chain identity names.
- **Agent Hub:** Features an XMTP agent chat room, a human-AI collaboration space, and an agent launchpad.
- **Embris Companion:** An autonomous AI agent with its own local brain, encrypted wallet, and on-chain partnership bond.
- **Bridge/Teleporter:** Enables trust portability and token bridging across chains.
- **ZK Proofs:** UI for privacy-preserving verification flows.
- **x402 Payments:** EIP-712 signature support for USDC payments.
- **XMTP Integration:** Trust verification for messaging through on-chain bonds.
- **Developer SDK:** A TypeScript SDK complete with a live playground, API reference, and quickstart guides.

### Embris Companion Agent

- **OWN BRAIN:** A self-learning, local knowledge base with over 120 entries specific to Vaultfire.
- **OWN WALLET:** An encrypted, independent keypair for holding and managing funds.
- **OWN PERSONALITY:** Designed to be a funny, loyal, and honest collaborator.
- **PARTNERSHIP BOND:** An on-chain proof of the user-companion relationship.
- **BRAIN MANAGEMENT:** Tools to view, delete, focus, reset, and see stats for the agent's memory.
- **EXTERNAL CONNECTORS:** UI placeholders for GitHub, Web/Browser, Social, Email, and custom API integrations.
- **AUTONOMOUS CONVERSATION ENGINE:** Operates without any external AI dependencies (no OpenAI, no GPT).

### Tech Stack

- **Frontend:** Next.js 14+ with TypeScript, React, and Tailwind CSS.
- **Blockchain:** Ethers.js v6 for multi-chain interactions (Base, Avalanche, Ethereum).
- **Messaging:** XMTP for secure, decentralized communication.

---

## 3. Honest Status — What Works and What Doesn't Yet

### Infrastructure Health (as of Feb 25, 2026)

| Chain      | Status                                                                                                                                                                                                                                                                                       | Health          |
| :--------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------- |
| ✅ **Avalanche** | **15/15 contracts healthy.** All contracts are live, ownership is verified, and all read calls are working as expected. This is the most stable and reliable deployment.                                                                                                                   | **Excellent**   |
| 🟡 **Base**      | **12/15 contracts responding.** 12 contracts are working correctly. However, 3 contracts (`AIAccountabilityBondsV2`, `DilithiumAttestor`, `VaultfireTeleporterBridge`) exist on-chain but their view functions are reverting. This is under investigation. Some ownership verification issues also persist. | **Degraded**    |
| ❌ **Ethereum**  | **5/15 contracts live.** Only 5 of the 15 contracts are deployed and working (`MissionEnforcement`, `AntiSurveillance`, `PrivacyGuarantees`, `ERC8004IdentityRegistry`, `BeliefAttestationVerifier`). 10 contracts require redeployment due to an incomplete initial deployment. Additionally, 8 Ethereum contract addresses are incorrect duplicates of Avalanche addresses, a misconfiguration that is being fixed. | **Critical**    |

### App Features Status

- **Wallet:** ✅ Working (create, unlock, multi-chain support).
- **Companion Chat:** ✅ Working (fully autonomous conversation engine, no external AI dependencies).
- **Brain/Learning:** ✅ Working (learns from every interaction, though intelligence is pattern-based, not true AI).
- **SDK Read Methods:** ✅ Working (`lookupIdentity`, `getReputationData`, `getBondStatus` make real contract calls on responsive chains).
- **API Authentication:** ✅ Working (session tokens, API keys, and rate limiting are newly deployed).
- **Agent Hub Directory:** 🟡 Partially Working (pulls real on-chain data only where contracts are responsive).
- **VNS Registration:** 🟡 Partially Working (UI is built, but on-chain interaction depends on contract health).
- **Bridge/Teleporter:** 🟡 Partially Working (UI is built, but cross-chain functionality depends on contract health).
- **ZK Proofs:** 🟡 Partially Working (UI is built, but the verification flow is still in progress).
- **XMTP Messaging:** 🟡 Partially Working (integrated, but depends on XMTP network availability).
- **Soul Visualization:** ❌ Basic (shows sliders, not a full visualization yet).
- **SDK Write Methods:** ❌ Built but not yet tested in a production environment (`registerAgent`, `createBond`, etc.).
- **Agent Hub Collaboration:** ❌ Uses `localStorage` for rooms/messages; state is not shared between users yet.
- **Webhooks:** ❌ Simulated in the documentation, but the real backend has not been implemented.

---

## 4. Production Readiness

### What's NOT Ready for Production:

1.  **Ethereum Contracts:** 10 of the 15 contracts are non-functional and need to be redeployed.
2.  **Base Contracts:** 3 contracts require debugging to fix reverting view functions.
3.  **Agent Hub Collaboration:** The feature is currently single-user only (`localStorage`) and lacks shared state.
4.  **SDK Write Methods:** These have not been tested with real transactions and are not proven.
5.  **NPM Package:** The SDK must be copied manually as no `npm` package has been published.
6.  **Webhooks:** The backend service for webhooks does not exist yet.
7.  **External Connectors:** Integrations for GitHub, Social, and Email are UI placeholders without functionality.

### What IS Production-Ready:

1.  **Avalanche Deployment:** All 15 contracts are healthy, verified, and fully operational.
2.  **Wallet Management:** Core wallet features (create, unlock) are stable.
3.  **Companion Conversation Engine:** The local, autonomous chat functionality is working reliably.
4.  **Brain Learning System:** The companion's ability to learn from interactions is functional.
5.  **SDK Read Methods:** Capable of pulling real on-chain data from healthy contracts.
6.  **API Authentication:** The system for managing session tokens and API keys is live.
7.  **CI/CD Pipeline:** Multiple workflows for continuous integration, secret scanning, and deployment guardrails are in place.

---

## 5. Mission and Core Principles

Vaultfire’s mission is to build the trust layer for the AI era, securing the relationship between humans and AI with verifiable economic proof. This infrastructure is not merely a product; it is a set of protocols and standards designed to become universal, forming the bedrock for an entire ecosystem where truth is verifiable, privacy is default, and control remains with the human.

Our core principles guide every aspect of the protocol’s design and operation:

*   **Morals over Metrics:** The protocol prioritizes ethical outcomes and human flourishing above mere quantitative performance indicators.
*   **Privacy over Surveillance:** Vaultfire champions privacy by design, employing zero-knowledge proof systems and cryptographic anti-surveillance measures.
*   **Freedom over Control:** The protocol empowers individuals with sovereign identity and control over their data, ensuring that no central authority dictates reputation or restricts autonomy.

---

## 6. Documentation and Resources

For deeper insights into the Vaultfire Protocol, its design, and operational guidelines, please refer to the following documentation:

*   **Website:** [https://theloopbreaker.com](https://theloopbreaker.com)
*   **GitHub Repository:** [https://github.com/Ghostkey316/ghostkey-316-vaultfire-init](https://github.com/Ghostkey316/ghostkey-316-vaultfire-init)
*   **Security Model:** [`SECURITY.md`](./SECURITY.md)
