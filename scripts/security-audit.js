/**
 * Comprehensive Security Audit for Universal Dignity Bonds
 *
 * Checks all 9 bond contracts for:
 * - Reentrancy vulnerabilities
 * - Access control issues
 * - External call safety
 * - Integer overflow/underflow
 * - Gas optimization opportunities
 * - Front-running risks
 * - Timestamp dependencies
 * - DoS vulnerabilities
 */

const fs = require('fs');
const path = require('path');

const CONTRACTS_DIR = path.join(__dirname, '../contracts');
const BOND_CONTRACTS = [
  'PurchasingPowerBonds.sol',
  'HealthCommonsBonds.sol',
  'AIAccountabilityBonds.sol',
  'LaborDignityBonds.sol',
  'EscapeVelocityBonds.sol',
  'CommonGroundBonds.sol',
  'AIPartnershipBonds.sol',
  'BuilderBeliefBonds.sol',
  'VerdantAnchorBonds.sol'
];

class SecurityAudit {
  constructor() {
    this.findings = {
      critical: [],
      high: [],
      medium: [],
      low: [],
      info: [],
      gasOptimizations: []
    };
  }

  /**
   * Main audit function
   */
  async audit() {
    console.log('🔍 Starting Security Audit of Universal Dignity Bonds...\n');

    for (const contractFile of BOND_CONTRACTS) {
      const contractPath = path.join(CONTRACTS_DIR, contractFile);
      const contractCode = fs.readFileSync(contractPath, 'utf8');
      const contractName = contractFile.replace('.sol', '');

      console.log(`\n📝 Auditing ${contractName}...`);

      this.auditContract(contractName, contractCode);
    }

    this.generateReport();
  }

  /**
   * Audit individual contract
   */
  auditContract(name, code) {
    this.checkReentrancy(name, code);
    this.checkAccessControl(name, code);
    this.checkExternalCalls(name, code);
    this.checkIntegerSafety(name, code);
    this.checkTimestampDependence(name, code);
    this.checkDoSPatterns(name, code);
    this.checkFrontRunning(name, code);
    this.checkGasOptimizations(name, code);
    this.checkInputValidation(name, code);
  }

  /**
   * Check for reentrancy vulnerabilities
   */
  checkReentrancy(name, code) {
    const hasExternalCalls = code.match(/\.transfer\(|\.send\(|\.call\{|\.call\(/g);
    const hasStateChanges = code.match(/\w+\[.*\]\.push\(|\w+\[.*\] = /g);

    if (hasExternalCalls && hasStateChanges) {
      const externalCallLines = this.findLineNumbers(code, /\.transfer\(|\.send\(|\.call\{/);
      const stateChangeLines = this.findLineNumbers(code, /\w+\[.*\]\.push\(|\w+\[.*\] = /);

      // Check if state changes happen after external calls (vulnerable pattern)
      externalCallLines.forEach(callLine => {
        const vulnerableChanges = stateChangeLines.filter(changeLine => changeLine > callLine);
        if (vulnerableChanges.length > 0) {
          this.findings.high.push({
            contract: name,
            issue: 'Potential Reentrancy Vulnerability',
            line: callLine,
            description: `External call at line ${callLine} with state changes after (lines: ${vulnerableChanges.join(', ')}). Use Checks-Effects-Interactions pattern.`,
            recommendation: 'Move state changes before external calls, or use OpenZeppelin ReentrancyGuard'
          });
        }
      });

      // Check for missing reentrancy guards on distribution functions
      if (code.includes('function distributeBond') && !code.includes('ReentrancyGuard') && !code.includes('nonReentrant')) {
        this.findings.medium.push({
          contract: name,
          issue: 'Missing Reentrancy Guard',
          description: 'distributeBond function lacks explicit reentrancy protection',
          recommendation: 'Consider adding OpenZeppelin ReentrancyGuard'
        });
      }
    }
  }

  /**
   * Check access control
   */
  checkAccessControl(name, code) {
    // Check for missing access control on critical functions
    const criticalFunctions = [
      'distributeBond',
      'submitMetrics',
      'submitAffordabilityMetrics',
      'submitBuildingMetrics',
      'submitRegenerationMetrics'
    ];

    criticalFunctions.forEach(func => {
      if (code.includes(`function ${func}`)) {
        const funcMatch = code.match(new RegExp(`function ${func}[^{]*{`, 's'));
        if (funcMatch && !funcMatch[0].includes('only') && !funcMatch[0].includes('require')) {
          // Check if there's a require inside the function
          const funcBody = this.extractFunctionBody(code, func);
          if (!funcBody.includes('require(') && !funcBody.includes('onlyOwner') && !funcBody.includes('onlyCompany')) {
            this.findings.high.push({
              contract: name,
              issue: 'Missing Access Control',
              function: func,
              description: `${func} function may lack proper access control`,
              recommendation: 'Add appropriate access control modifiers or require statements'
            });
          }
        }
      }
    });

    // Check for proper modifier implementation
    if (code.includes('modifier only') || code.includes('modifier bondExists')) {
      this.findings.info.push({
        contract: name,
        issue: 'Access Control Modifiers Present',
        description: 'Contract uses access control modifiers - verify implementation correctness'
      });
    }
  }

  /**
   * Check external calls
   */
  checkExternalCalls(name, code) {
    // Check for unchecked external calls
    const calls = code.match(/\.transfer\([^)]+\)/g) || [];
    const sends = code.match(/\.send\([^)]+\)/g) || [];
    const lowLevelCalls = code.match(/\.call\{[^}]+\}\([^)]*\)/g) || [];

    if (sends.length > 0) {
      this.findings.medium.push({
        contract: name,
        issue: 'Use of .send()',
        count: sends.length,
        description: '.send() can fail silently. Prefer .transfer() or check return value',
        recommendation: 'Replace .send() with .transfer() or check return value explicitly'
      });
    }

    if (lowLevelCalls.length > 0) {
      this.findings.info.push({
        contract: name,
        issue: 'Low-level calls detected',
        count: lowLevelCalls.length,
        description: 'Low-level .call() detected - ensure return value is checked',
        recommendation: 'Verify all low-level calls check return values'
      });
    }
  }

  /**
   * Check integer safety
   */
  checkIntegerSafety(name, code) {
    // Solidity 0.8.x has built-in overflow protection
    const solidityVersion = code.match(/pragma solidity \^?([\d.]+)/);
    if (solidityVersion) {
      const version = solidityVersion[1];
      if (version.startsWith('0.8')) {
        this.findings.info.push({
          contract: name,
          issue: 'Integer Overflow Protection',
          description: `Using Solidity ${version} with built-in overflow/underflow protection`,
          recommendation: 'Verify no unchecked blocks bypass this protection'
        });
      }
    }

    // Check for unchecked blocks
    if (code.includes('unchecked')) {
      const uncheckedCount = (code.match(/unchecked\s*{/g) || []).length;
      this.findings.medium.push({
        contract: name,
        issue: 'Unchecked Arithmetic Blocks',
        count: uncheckedCount,
        description: 'Contract uses unchecked blocks that bypass overflow protection',
        recommendation: 'Verify arithmetic in unchecked blocks cannot overflow/underflow'
      });
    }
  }

  /**
   * Check timestamp dependence
   */
  checkTimestampDependence(name, code) {
    const timestampUsage = (code.match(/block\.timestamp/g) || []).length;
    if (timestampUsage > 0) {
      this.findings.low.push({
        contract: name,
        issue: 'Timestamp Dependence',
        count: timestampUsage,
        description: `Contract uses block.timestamp (${timestampUsage} times)`,
        recommendation: 'Ensure timestamp manipulation (±15 seconds) does not create vulnerabilities. Acceptable for time-based multipliers.'
      });
    }
  }

  /**
   * Check for DoS patterns
   */
  checkDoSPatterns(name, code) {
    // Check for unbounded loops
    const forLoops = code.match(/for\s*\([^)]+\)/g) || [];
    forLoops.forEach((loop, index) => {
      if (loop.includes('.length') && !loop.includes('i <')) {
        this.findings.medium.push({
          contract: name,
          issue: 'Potential Unbounded Loop',
          loop: loop.substring(0, 50),
          description: 'Loop over array with external length - potential DoS if array grows large',
          recommendation: 'Consider pagination or gas limits for loops over user-controlled arrays'
        });
      }
    });

    // Check for state changes in loops
    if (code.match(/for.*{[^}]*\w+\[.*\] = /s)) {
      this.findings.low.push({
        contract: name,
        issue: 'State Changes in Loops',
        description: 'Contract modifies state in loops - monitor gas costs',
        recommendation: 'Ensure loops cannot grow unbounded'
      });
    }
  }

  /**
   * Check for front-running risks
   */
  checkFrontRunning(name, code) {
    // Distribution functions are susceptible to front-running
    if (code.includes('distributeBond')) {
      this.findings.low.push({
        contract: name,
        issue: 'Front-running Risk in Distribution',
        description: 'Distribution function visible in mempool before execution',
        recommendation: 'Document that distribution timing is not critical for security. Consider commit-reveal if needed.'
      });
    }

    // Check for price/value dependencies
    if (code.includes('calculateBondValue') || code.includes('calculateAppreciation')) {
      this.findings.info.push({
        contract: name,
        issue: 'Value Calculation Transparency',
        description: 'Bond value calculations are transparent and deterministic',
        recommendation: 'Verify calculations cannot be manipulated between submission and distribution'
      });
    }
  }

  /**
   * Check gas optimizations
   */
  checkGasOptimizations(name, code) {
    // Check for storage reads in loops
    if (code.match(/for.*{[^}]*storage\s+\w+\s*=/s)) {
      this.findings.gasOptimizations.push({
        contract: name,
        optimization: 'Cache Storage Reads',
        description: 'Storage variables read in loops - cache in memory to save gas',
        recommendation: 'Cache storage array/mapping references before loops'
      });
    }

    // Check for multiple same state reads
    const stateReads = code.match(/bonds\[bondId\]/g) || [];
    if (stateReads.length > 3) {
      this.findings.gasOptimizations.push({
        contract: name,
        optimization: 'Cache Bond Reference',
        count: stateReads.length,
        description: `bonds[bondId] accessed ${stateReads.length} times in contract`,
        recommendation: 'Cache Bond storage reference: Bond storage bond = bonds[bondId];'
      });
    }

    // Check for view functions that could be pure
    const viewFunctions = code.match(/function\s+\w+[^{]*view[^{]*returns/g) || [];
    this.findings.info.push({
      contract: name,
      issue: 'View Functions',
      count: viewFunctions.length,
      description: `${viewFunctions.length} view functions - verify none can be pure`,
      recommendation: 'Review view functions to see if any can be marked pure'
    });
  }

  /**
   * Check input validation
   */
  checkInputValidation(name, code) {
    const publicFunctions = code.match(/function\s+\w+[^{]*external/g) || [];
    publicFunctions.forEach(func => {
      const funcName = func.match(/function\s+(\w+)/)[1];
      const funcBody = this.extractFunctionBody(code, funcName);

      // Check for input validation
      const hasRequire = funcBody.includes('require(');
      const hasRevert = funcBody.includes('revert');
      const hasModifier = func.includes('only') || func.includes('bondExists');

      if (!hasRequire && !hasRevert && !hasModifier) {
        this.findings.low.push({
          contract: name,
          issue: 'Possible Missing Input Validation',
          function: funcName,
          description: `${funcName} may lack input validation`,
          recommendation: 'Review function to ensure all inputs are validated'
        });
      }
    });
  }

  /**
   * Helper: Find line numbers for pattern
   */
  findLineNumbers(code, pattern) {
    const lines = code.split('\n');
    const lineNumbers = [];
    lines.forEach((line, index) => {
      if (pattern.test(line)) {
        lineNumbers.push(index + 1);
      }
    });
    return lineNumbers;
  }

  /**
   * Helper: Extract function body
   */
  extractFunctionBody(code, funcName) {
    const funcRegex = new RegExp(`function\\s+${funcName}[^{]*{([^}]*)}`, 's');
    const match = code.match(funcRegex);
    return match ? match[1] : '';
  }

  /**
   * Generate audit report
   */
  generateReport() {
    console.log('\n\n' + '='.repeat(80));
    console.log('SECURITY AUDIT REPORT - Universal Dignity Bonds');
    console.log('='.repeat(80) + '\n');

    const totalFindings =
      this.findings.critical.length +
      this.findings.high.length +
      this.findings.medium.length +
      this.findings.low.length;

    console.log(`📊 Summary:`);
    console.log(`   Critical: ${this.findings.critical.length}`);
    console.log(`   High:     ${this.findings.high.length}`);
    console.log(`   Medium:   ${this.findings.medium.length}`);
    console.log(`   Low:      ${this.findings.low.length}`);
    console.log(`   Info:     ${this.findings.info.length}`);
    console.log(`   Gas Optimizations: ${this.findings.gasOptimizations.length}\n`);

    // Critical findings
    if (this.findings.critical.length > 0) {
      console.log('\n🚨 CRITICAL FINDINGS:\n');
      this.findings.critical.forEach((finding, i) => {
        console.log(`${i + 1}. ${finding.contract} - ${finding.issue}`);
        console.log(`   ${finding.description}`);
        console.log(`   ➜ ${finding.recommendation}\n`);
      });
    }

    // High findings
    if (this.findings.high.length > 0) {
      console.log('\n⚠️  HIGH SEVERITY FINDINGS:\n');
      this.findings.high.forEach((finding, i) => {
        console.log(`${i + 1}. ${finding.contract} - ${finding.issue}`);
        console.log(`   ${finding.description}`);
        console.log(`   ➜ ${finding.recommendation}\n`);
      });
    }

    // Medium findings
    if (this.findings.medium.length > 0) {
      console.log('\n⚡ MEDIUM SEVERITY FINDINGS:\n');
      this.findings.medium.forEach((finding, i) => {
        console.log(`${i + 1}. ${finding.contract} - ${finding.issue}`);
        console.log(`   ${finding.description}`);
        console.log(`   ➜ ${finding.recommendation}\n`);
      });
    }

    // Low findings
    if (this.findings.low.length > 0) {
      console.log('\n📝 LOW SEVERITY FINDINGS:\n');
      this.findings.low.forEach((finding, i) => {
        console.log(`${i + 1}. ${finding.contract} - ${finding.issue}`);
        console.log(`   ${finding.description}`);
        console.log(`   ➜ ${finding.recommendation}\n`);
      });
    }

    // Gas optimizations
    if (this.findings.gasOptimizations.length > 0) {
      console.log('\n⛽ GAS OPTIMIZATION OPPORTUNITIES:\n');
      this.findings.gasOptimizations.forEach((finding, i) => {
        console.log(`${i + 1}. ${finding.contract} - ${finding.optimization}`);
        console.log(`   ${finding.description}`);
        console.log(`   ➜ ${finding.recommendation}\n`);
      });
    }

    // Info findings
    if (this.findings.info.length > 0) {
      console.log('\nℹ️  INFORMATIONAL FINDINGS:\n');
      this.findings.info.forEach((finding, i) => {
        console.log(`${i + 1}. ${finding.contract} - ${finding.issue}`);
        console.log(`   ${finding.description}\n`);
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log('AUDIT COMPLETE');
    console.log('='.repeat(80) + '\n');

    // Overall assessment
    if (this.findings.critical.length === 0 && this.findings.high.length === 0) {
      console.log('✅ No critical or high severity issues found!');
    } else {
      console.log('⚠️  Address critical and high severity findings before deployment!');
    }

    // Save report to file
    this.saveReportToFile();
  }

  /**
   * Save report to file
   */
  saveReportToFile() {
    const reportPath = path.join(__dirname, '../SECURITY_AUDIT_REPORT.md');
    let report = `# Security Audit Report - Universal Dignity Bonds\n\n`;
    report += `**Date:** ${new Date().toISOString()}\n\n`;
    report += `## Summary\n\n`;
    report += `- **Critical:** ${this.findings.critical.length}\n`;
    report += `- **High:** ${this.findings.high.length}\n`;
    report += `- **Medium:** ${this.findings.medium.length}\n`;
    report += `- **Low:** ${this.findings.low.length}\n`;
    report += `- **Informational:** ${this.findings.info.length}\n`;
    report += `- **Gas Optimizations:** ${this.findings.gasOptimizations.length}\n\n`;

    ['critical', 'high', 'medium', 'low'].forEach(severity => {
      if (this.findings[severity].length > 0) {
        report += `## ${severity.toUpperCase()} Findings\n\n`;
        this.findings[severity].forEach((finding, i) => {
          report += `### ${i + 1}. ${finding.contract} - ${finding.issue}\n\n`;
          report += `**Description:** ${finding.description}\n\n`;
          report += `**Recommendation:** ${finding.recommendation}\n\n`;
        });
      }
    });

    fs.writeFileSync(reportPath, report);
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  }
}

// Run audit
const audit = new SecurityAudit();
audit.audit().catch(console.error);
