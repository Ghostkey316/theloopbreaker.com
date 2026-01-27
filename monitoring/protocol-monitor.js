/**
 * Vaultfire Protocol Monitoring & Alerting System
 *
 * This monitoring system tracks critical protocol health metrics and sends
 * alerts when anomalies or issues are detected.
 *
 * Features:
 * - Real-time protocol health monitoring
 * - Yield pool balance tracking
 * - Reserve ratio monitoring
 * - Distribution activity tracking
 * - Security event detection
 * - Automated alerting (Slack, Discord, Email, PagerDuty)
 *
 * Usage:
 *   node monitoring/protocol-monitor.js --network base
 *   pm2 start monitoring/protocol-monitor.js --name vaultfire-monitor
 */

const { ethers } = require("ethers");
const axios = require("axios");

// Configuration
const config = {
    // RPC Configuration
    rpc: {
        base: process.env.BASE_RPC_URL || "https://mainnet.base.org",
        baseSepolia: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
    },

    // Contract Addresses (update after deployment)
    contracts: {
        aiPartnershipBonds: process.env.AI_PARTNERSHIP_BONDS_ADDRESS || "",
        aiAccountabilityBonds: process.env.AI_ACCOUNTABILITY_BONDS_ADDRESS || "",
        beliefVerifier: process.env.BELIEF_VERIFIER_ADDRESS || "",
    },

    // Alert Thresholds
    thresholds: {
        yieldPool: {
            warningMultiplier: 2.0,     // Alert if < 2x minimum
            criticalMultiplier: 1.0,    // Critical if < 1x minimum
        },
        reserveRatio: {
            warningThreshold: 6000,     // 60% (basis points)
            criticalThreshold: 5000,    // 50% (basis points)
        },
        distribution: {
            largeAmountETH: 10,         // Alert if single distribution > 10 ETH
            criticalAmountETH: 100,     // Critical if > 100 ETH
        },
        bondCreation: {
            ratePerHour: 100,           // Alert if > 100 bonds/hour
        },
        challenges: {
            activeCount: 10,            // Alert if > 10 active challenges
        },
        proofVerification: {
            failureRatePercent: 5,      // Alert if failure rate > 5%
        },
    },

    // Alert Channels
    alerts: {
        slack: {
            enabled: process.env.SLACK_WEBHOOK_URL ? true : false,
            webhookUrl: process.env.SLACK_WEBHOOK_URL || "",
            channel: "#vaultfire-alerts",
        },
        discord: {
            enabled: process.env.DISCORD_WEBHOOK_URL ? true : false,
            webhookUrl: process.env.DISCORD_WEBHOOK_URL || "",
        },
        email: {
            enabled: false, // Configure SendGrid or similar
        },
        pagerduty: {
            enabled: process.env.PAGERDUTY_API_KEY ? true : false,
            apiKey: process.env.PAGERDUTY_API_KEY || "",
            serviceId: process.env.PAGERDUTY_SERVICE_ID || "",
        },
    },

    // Monitoring Interval
    checkIntervalSeconds: parseInt(process.env.CHECK_INTERVAL_SECONDS) || 300, // 5 minutes
};

// Contract ABIs (minimal for monitoring)
const PARTNERSHIP_BONDS_ABI = [
    "function getYieldPoolBalance() external view returns (uint256)",
    "function getMinimumYieldPool() external view returns (uint256)",
    "function getReserveRatio() public view returns (uint256)",
    "function getProtocolHealth() external view returns (bool isHealthy, bool yieldPoolOK, bool reserveRatioOK, uint256 currentRatio)",
    "function nextBondId() public view returns (uint256)",
    "event BondCreated(uint256 indexed bondId, address indexed human, address indexed aiAgent, string partnershipType, uint256 stakeAmount, uint256 timestamp)",
    "event BondDistributed(uint256 indexed bondId, uint256 humanShare, uint256 aiShare, uint256 fundShare, string reason, uint256 timestamp)",
    "event AIDominationPenalty(uint256 indexed bondId, string reason, uint256 timestamp)",
    "event LowYieldPoolWarning(uint256 currentBalance, uint256 minimumRequired, uint256 deficit)",
];

const ACCOUNTABILITY_BONDS_ABI = [
    "function getYieldPoolBalance() external view returns (uint256)",
    "function getMinimumYieldPool() external view returns (uint256)",
    "function getReserveRatio() public view returns (uint256)",
    "function nextBondId() public view returns (uint256)",
    "event BondCreated(uint256 indexed bondId, address indexed aiCompany, string companyName, uint256 quarterlyRevenue, uint256 stakeAmount, uint256 timestamp)",
    "event BondDistributed(uint256 indexed bondId, address indexed aiCompany, uint256 humanShare, uint256 aiCompanyShare, int256 appreciation, string reason, uint256 timestamp)",
    "event ProfitsLocked(uint256 indexed bondId, string reason, uint256 timestamp)",
    "event MetricsChallenged(uint256 indexed bondId, address indexed challenger, string reason, uint256 challengeStake, uint256 timestamp)",
];

const BELIEF_VERIFIER_ABI = [
    "event ProofVerified(bytes32 indexed beliefHash, address indexed proverAddress, uint256 epoch, uint256 moduleID, uint256 timestamp)",
    "event ProofVerificationFailed(bytes32 indexed beliefHash, address indexed proverAddress, string reason, uint256 timestamp)",
];

class ProtocolMonitor {
    constructor(network = "base") {
        this.network = network;
        this.provider = new ethers.JsonRpcProvider(config.rpc[network]);
        this.contracts = this.initContracts();
        this.metrics = {
            bondCreationCount: 0,
            distributionCount: 0,
            proofVerificationCount: 0,
            proofVerificationFailures: 0,
            lastCheckTime: Date.now(),
        };
    }

    initContracts() {
        const contracts = {};

        if (config.contracts.aiPartnershipBonds) {
            contracts.partnershipBonds = new ethers.Contract(
                config.contracts.aiPartnershipBonds,
                PARTNERSHIP_BONDS_ABI,
                this.provider
            );
        }

        if (config.contracts.aiAccountabilityBonds) {
            contracts.accountabilityBonds = new ethers.Contract(
                config.contracts.aiAccountabilityBonds,
                ACCOUNTABILITY_BONDS_ABI,
                this.provider
            );
        }

        if (config.contracts.beliefVerifier) {
            contracts.beliefVerifier = new ethers.Contract(
                config.contracts.beliefVerifier,
                BELIEF_VERIFIER_ABI,
                this.provider
            );
        }

        return contracts;
    }

    async start() {
        console.log(`🚀 Vaultfire Protocol Monitor Starting`);
        console.log(`📡 Network: ${this.network}`);
        console.log(`🔍 Check Interval: ${config.checkIntervalSeconds}s\n`);

        // Initial health check
        await this.runHealthChecks();

        // Set up event listeners
        this.setupEventListeners();

        // Schedule periodic health checks
        setInterval(() => {
            this.runHealthChecks().catch(console.error);
        }, config.checkIntervalSeconds * 1000);

        console.log("✅ Monitor running. Press Ctrl+C to stop.\n");
    }

    async runHealthChecks() {
        const timestamp = new Date().toISOString();
        console.log(`\n⏰ Health Check: ${timestamp}`);

        try {
            // Check Partnership Bonds
            if (this.contracts.partnershipBonds) {
                await this.checkPartnershipBondsHealth();
            }

            // Check Accountability Bonds
            if (this.contracts.accountabilityBonds) {
                await this.checkAccountabilityBondsHealth();
            }

            // Check Proof Verification
            await this.checkProofVerificationHealth();

            console.log("✅ Health checks complete\n");
        } catch (error) {
            console.error("❌ Health check failed:", error.message);
            await this.sendAlert("CRITICAL", "Health Check Failed", error.message);
        }
    }

    async checkPartnershipBondsHealth() {
        const contract = this.contracts.partnershipBonds;

        try {
            // Get protocol health
            const health = await contract.getProtocolHealth();
            const yieldPoolBalance = await contract.getYieldPoolBalance();
            const minimumYieldPool = await contract.getMinimumYieldPool();

            console.log("📊 Partnership Bonds Health:");
            console.log(`   - Overall Health: ${health.isHealthy ? "✅ Healthy" : "⚠️ Unhealthy"}`);
            console.log(`   - Yield Pool: ${ethers.formatEther(yieldPoolBalance)} ETH`);
            console.log(`   - Minimum Required: ${ethers.formatEther(minimumYieldPool)} ETH`);
            console.log(`   - Reserve Ratio: ${health.currentRatio / 100}%`);

            // Check yield pool warnings
            const ratio = Number(yieldPoolBalance) / Number(minimumYieldPool);
            if (ratio < config.thresholds.yieldPool.criticalMultiplier) {
                await this.sendAlert(
                    "CRITICAL",
                    "Partnership Bonds: Critical Yield Pool",
                    `Yield pool at ${ethers.formatEther(yieldPoolBalance)} ETH (< minimum ${ethers.formatEther(minimumYieldPool)} ETH)`
                );
            } else if (ratio < config.thresholds.yieldPool.warningMultiplier) {
                await this.sendAlert(
                    "WARNING",
                    "Partnership Bonds: Low Yield Pool",
                    `Yield pool at ${ethers.formatEther(yieldPoolBalance)} ETH (< 2x minimum)`
                );
            }

            // Check reserve ratio
            if (health.currentRatio < config.thresholds.reserveRatio.criticalThreshold) {
                await this.sendAlert(
                    "CRITICAL",
                    "Partnership Bonds: Critical Reserve Ratio",
                    `Reserve ratio at ${health.currentRatio / 100}% (< 50%)`
                );
            } else if (health.currentRatio < config.thresholds.reserveRatio.warningThreshold) {
                await this.sendAlert(
                    "WARNING",
                    "Partnership Bonds: Low Reserve Ratio",
                    `Reserve ratio at ${health.currentRatio / 100}% (< 60%)`
                );
            }
        } catch (error) {
            console.error("   ❌ Partnership bonds health check failed:", error.message);
        }
    }

    async checkAccountabilityBondsHealth() {
        const contract = this.contracts.accountabilityBonds;

        try {
            const yieldPoolBalance = await contract.getYieldPoolBalance();
            const minimumYieldPool = await contract.getMinimumYieldPool();
            const reserveRatio = await contract.getReserveRatio();

            console.log("📊 Accountability Bonds Health:");
            console.log(`   - Yield Pool: ${ethers.formatEther(yieldPoolBalance)} ETH`);
            console.log(`   - Minimum Required: ${ethers.formatEther(minimumYieldPool)} ETH`);
            console.log(`   - Reserve Ratio: ${reserveRatio / 100}%`);

            // Check yield pool warnings
            const ratio = Number(yieldPoolBalance) / Number(minimumYieldPool);
            if (ratio < config.thresholds.yieldPool.criticalMultiplier) {
                await this.sendAlert(
                    "CRITICAL",
                    "Accountability Bonds: Critical Yield Pool",
                    `Yield pool at ${ethers.formatEther(yieldPoolBalance)} ETH`
                );
            }

            // Check reserve ratio
            if (reserveRatio < config.thresholds.reserveRatio.criticalThreshold) {
                await this.sendAlert(
                    "CRITICAL",
                    "Accountability Bonds: Critical Reserve Ratio",
                    `Reserve ratio at ${reserveRatio / 100}%`
                );
            }
        } catch (error) {
            console.error("   ❌ Accountability bonds health check failed:", error.message);
        }
    }

    async checkProofVerificationHealth() {
        const totalVerifications = this.metrics.proofVerificationCount + this.metrics.proofVerificationFailures;

        if (totalVerifications > 0) {
            const failureRate = (this.metrics.proofVerificationFailures / totalVerifications) * 100;

            console.log("📊 Proof Verification Health:");
            console.log(`   - Total Verifications: ${totalVerifications}`);
            console.log(`   - Failures: ${this.metrics.proofVerificationFailures}`);
            console.log(`   - Failure Rate: ${failureRate.toFixed(2)}%`);

            if (failureRate > config.thresholds.proofVerification.failureRatePercent) {
                await this.sendAlert(
                    "WARNING",
                    "High Proof Verification Failure Rate",
                    `${failureRate.toFixed(2)}% of proofs failing (${this.metrics.proofVerificationFailures}/${totalVerifications})`
                );
            }
        }
    }

    setupEventListeners() {
        console.log("👂 Setting up event listeners...\n");

        // Partnership Bonds Events
        if (this.contracts.partnershipBonds) {
            this.contracts.partnershipBonds.on("BondCreated", this.handleBondCreated.bind(this));
            this.contracts.partnershipBonds.on("BondDistributed", this.handlePartnershipDistribution.bind(this));
            this.contracts.partnershipBonds.on("AIDominationPenalty", this.handleDominationPenalty.bind(this));
            this.contracts.partnershipBonds.on("LowYieldPoolWarning", this.handleLowYieldPool.bind(this));
        }

        // Accountability Bonds Events
        if (this.contracts.accountabilityBonds) {
            this.contracts.accountabilityBonds.on("BondCreated", this.handleBondCreated.bind(this));
            this.contracts.accountabilityBonds.on("BondDistributed", this.handleAccountabilityDistribution.bind(this));
            this.contracts.accountabilityBonds.on("ProfitsLocked", this.handleProfitsLocked.bind(this));
            this.contracts.accountabilityBonds.on("MetricsChallenged", this.handleMetricsChallenged.bind(this));
        }

        // Belief Verifier Events
        if (this.contracts.beliefVerifier) {
            this.contracts.beliefVerifier.on("ProofVerified", this.handleProofVerified.bind(this));
            this.contracts.beliefVerifier.on("ProofVerificationFailed", this.handleProofFailed.bind(this));
        }
    }

    handleBondCreated(bondId, ...args) {
        this.metrics.bondCreationCount++;
        console.log(`📝 Bond Created: #${bondId}`);
    }

    handlePartnershipDistribution(bondId, humanShare, aiShare, fundShare, reason) {
        this.metrics.distributionCount++;
        const totalETH = ethers.formatEther(humanShare + aiShare + fundShare);
        console.log(`💰 Partnership Distribution: Bond #${bondId} - ${totalETH} ETH`);

        const amount = Number(ethers.formatEther(humanShare + aiShare + fundShare));
        if (amount > config.thresholds.distribution.criticalAmountETH) {
            this.sendAlert(
                "CRITICAL",
                "Large Partnership Distribution",
                `Bond #${bondId} distributed ${totalETH} ETH. Reason: ${reason}`
            );
        } else if (amount > config.thresholds.distribution.largeAmountETH) {
            this.sendAlert(
                "INFO",
                "Large Partnership Distribution",
                `Bond #${bondId} distributed ${totalETH} ETH`
            );
        }
    }

    handleAccountabilityDistribution(bondId, aiCompany, humanShare, aiCompanyShare) {
        this.metrics.distributionCount++;
        const totalETH = ethers.formatEther(humanShare + aiCompanyShare);
        console.log(`💰 Accountability Distribution: Bond #${bondId} - ${totalETH} ETH`);

        const amount = Number(ethers.formatEther(humanShare + aiCompanyShare));
        if (amount > config.thresholds.distribution.criticalAmountETH) {
            this.sendAlert(
                "CRITICAL",
                "Large Accountability Distribution",
                `Bond #${bondId} distributed ${totalETH} ETH to ${aiCompany}`
            );
        }
    }

    handleDominationPenalty(bondId, reason) {
        console.log(`⚠️ AI Domination Penalty: Bond #${bondId} - ${reason}`);
        this.sendAlert(
            "WARNING",
            "AI Domination Penalty Activated",
            `Bond #${bondId}: ${reason}. 100% to human, 0% to AI.`
        );
    }

    handleProfitsLocked(bondId, reason) {
        console.log(`🔒 Profits Locked: Bond #${bondId} - ${reason}`);
        this.sendAlert(
            "WARNING",
            "AI Profits Locked",
            `Bond #${bondId}: ${reason}. Humans suffering - 100% to humans.`
        );
    }

    handleMetricsChallenged(bondId, challenger, reason) {
        console.log(`🚨 Metrics Challenged: Bond #${bondId} by ${challenger}`);
        this.sendAlert(
            "INFO",
            "Metrics Challenge Submitted",
            `Bond #${bondId} challenged: ${reason}`
        );
    }

    handleLowYieldPool(currentBalance, minimumRequired, deficit) {
        console.log(`⚠️ Low Yield Pool Warning: ${ethers.formatEther(currentBalance)} ETH`);
        this.sendAlert(
            "WARNING",
            "Low Yield Pool Warning",
            `Current: ${ethers.formatEther(currentBalance)} ETH, Minimum: ${ethers.formatEther(minimumRequired)} ETH, Deficit: ${ethers.formatEther(deficit)} ETH`
        );
    }

    handleProofVerified(beliefHash, proverAddress, epoch, moduleID) {
        this.metrics.proofVerificationCount++;
    }

    handleProofFailed(beliefHash, proverAddress, reason) {
        this.metrics.proofVerificationFailures++;
        console.log(`❌ Proof Verification Failed: ${proverAddress.slice(0, 10)}... - ${reason}`);

        // Alert if multiple failures
        if (this.metrics.proofVerificationFailures % 10 === 0) {
            this.sendAlert(
                "WARNING",
                "Multiple Proof Verification Failures",
                `${this.metrics.proofVerificationFailures} proofs have failed verification`
            );
        }
    }

    async sendAlert(severity, title, message) {
        const alert = {
            severity,
            title,
            message,
            timestamp: new Date().toISOString(),
            network: this.network,
        };

        console.log(`\n🚨 ALERT [${severity}]: ${title}`);
        console.log(`   ${message}\n`);

        // Send to Slack
        if (config.alerts.slack.enabled) {
            await this.sendSlackAlert(alert);
        }

        // Send to Discord
        if (config.alerts.discord.enabled) {
            await this.sendDiscordAlert(alert);
        }

        // Send to PagerDuty (critical only)
        if (config.alerts.pagerduty.enabled && severity === "CRITICAL") {
            await this.sendPagerDutyAlert(alert);
        }
    }

    async sendSlackAlert(alert) {
        try {
            const color = {
                "CRITICAL": "#FF0000",
                "WARNING": "#FFA500",
                "INFO": "#0000FF",
            }[alert.severity] || "#808080";

            const payload = {
                channel: config.alerts.slack.channel,
                attachments: [{
                    color: color,
                    title: `[${alert.severity}] ${alert.title}`,
                    text: alert.message,
                    fields: [
                        { title: "Network", value: alert.network, short: true },
                        { title: "Time", value: alert.timestamp, short: true },
                    ],
                }],
            };

            await axios.post(config.alerts.slack.webhookUrl, payload);
        } catch (error) {
            console.error("Failed to send Slack alert:", error.message);
        }
    }

    async sendDiscordAlert(alert) {
        try {
            const color = {
                "CRITICAL": 16711680,  // Red
                "WARNING": 16753920,   // Orange
                "INFO": 255,           // Blue
            }[alert.severity] || 8421504;

            const payload = {
                embeds: [{
                    title: `[${alert.severity}] ${alert.title}`,
                    description: alert.message,
                    color: color,
                    fields: [
                        { name: "Network", value: alert.network, inline: true },
                        { name: "Time", value: alert.timestamp, inline: true },
                    ],
                }],
            };

            await axios.post(config.alerts.discord.webhookUrl, payload);
        } catch (error) {
            console.error("Failed to send Discord alert:", error.message);
        }
    }

    async sendPagerDutyAlert(alert) {
        try {
            const payload = {
                routing_key: config.alerts.pagerduty.apiKey,
                event_action: "trigger",
                payload: {
                    summary: `${alert.title}: ${alert.message}`,
                    severity: "critical",
                    source: `Vaultfire ${alert.network}`,
                    custom_details: {
                        network: alert.network,
                        timestamp: alert.timestamp,
                    },
                },
            };

            await axios.post("https://events.pagerduty.com/v2/enqueue", payload);
        } catch (error) {
            console.error("Failed to send PagerDuty alert:", error.message);
        }
    }
}

// Main execution
if (require.main === module) {
    const args = process.argv.slice(2);
    const networkArg = args.find(arg => arg.startsWith("--network="));
    const network = networkArg ? networkArg.split("=")[1] : "base";

    const monitor = new ProtocolMonitor(network);
    monitor.start().catch(console.error);
}

module.exports = ProtocolMonitor;
