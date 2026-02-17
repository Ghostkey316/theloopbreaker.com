/**
 * Tests for the Vaultfire Agent Tasks Module
 */

import { formatReport, TaskReport } from './tasks';

describe('formatReport', () => {
  const baseReport: TaskReport = {
    timestamp: '2026-02-17T12:00:00.000Z',
    cycle: 1,
    protocolHealth: null,
    protocolStats: null,
    agentStatus: null,
    errors: [],
  };

  it('should format a minimal report', () => {
    const output = formatReport(baseReport);
    expect(output).toContain('Vaultfire Sentinel Report');
    expect(output).toContain('Cycle: #1');
    expect(output).toContain('2026-02-17T12:00:00.000Z');
    expect(output).toContain('End Report');
  });

  it('should include protocol health when present', () => {
    const report: TaskReport = {
      ...baseReport,
      protocolHealth: {
        isHealthy: true,
        yieldPoolOK: true,
        reserveRatioOK: true,
        currentRatio: 150,
      },
    };

    const output = formatReport(report);
    expect(output).toContain('Protocol Health:');
    expect(output).toContain('Healthy: true');
    expect(output).toContain('Yield Pool OK: true');
    expect(output).toContain('Reserve Ratio OK: true');
    expect(output).toContain('Current Ratio: 150');
  });

  it('should include protocol statistics when present', () => {
    const report: TaskReport = {
      ...baseReport,
      protocolStats: {
        totalAgents: 5,
        totalBonds: 3,
        totalActiveBondValue: '1.5',
        yieldPoolBalance: '10.0',
        bondsPaused: false,
        oracleCount: 2,
        oracleRounds: 7,
      },
    };

    const output = formatReport(report);
    expect(output).toContain('Protocol Statistics:');
    expect(output).toContain('Total Agents: 5');
    expect(output).toContain('Total Bonds: 3');
    expect(output).toContain('Active Bond Value: 1.5 ETH');
    expect(output).toContain('Yield Pool: 10.0 ETH');
    expect(output).toContain('Oracle Count: 2');
  });

  it('should include agent status when present', () => {
    const report: TaskReport = {
      ...baseReport,
      agentStatus: {
        address: '0x1234567890abcdef1234567890abcdef12345678',
        balanceETH: '0.05',
        isRegistered: true,
        isActive: true,
        isOracle: false,
        activeBondId: 42,
        bondQualityScore: 85,
      },
    };

    const output = formatReport(report);
    expect(output).toContain('Agent Status:');
    expect(output).toContain('0x1234567890abcdef1234567890abcdef12345678');
    expect(output).toContain('Balance: 0.05 ETH');
    expect(output).toContain('Registered: true');
    expect(output).toContain('Active Bond ID: 42');
    expect(output).toContain('Bond Quality: 85');
  });

  it('should include errors when present', () => {
    const report: TaskReport = {
      ...baseReport,
      errors: ['RPC timeout', 'Contract call reverted'],
    };

    const output = formatReport(report);
    expect(output).toContain('Errors:');
    expect(output).toContain('RPC timeout');
    expect(output).toContain('Contract call reverted');
  });

  it('should handle null bond ID and quality score', () => {
    const report: TaskReport = {
      ...baseReport,
      agentStatus: {
        address: '0x0000000000000000000000000000000000000000',
        balanceETH: '0.0',
        isRegistered: false,
        isActive: false,
        isOracle: false,
        activeBondId: null,
        bondQualityScore: null,
      },
    };

    const output = formatReport(report);
    expect(output).toContain('Active Bond ID: none');
    expect(output).toContain('Bond Quality: N/A');
  });

  it('should format a complete report with all sections', () => {
    const report: TaskReport = {
      timestamp: '2026-02-17T15:30:00.000Z',
      cycle: 42,
      protocolHealth: {
        isHealthy: true,
        yieldPoolOK: true,
        reserveRatioOK: true,
        currentRatio: 200,
      },
      protocolStats: {
        totalAgents: 10,
        totalBonds: 5,
        totalActiveBondValue: '2.5',
        yieldPoolBalance: '20.0',
        bondsPaused: false,
        oracleCount: 3,
        oracleRounds: 15,
      },
      agentStatus: {
        address: '0xABCDEF1234567890ABCDEF1234567890ABCDEF12',
        balanceETH: '0.1',
        isRegistered: true,
        isActive: true,
        isOracle: true,
        activeBondId: 1,
        bondQualityScore: 95,
      },
      errors: [],
    };

    const output = formatReport(report);
    expect(output).toContain('Cycle: #42');
    expect(output).toContain('Protocol Health:');
    expect(output).toContain('Protocol Statistics:');
    expect(output).toContain('Agent Status:');
    expect(output).not.toContain('Errors:');
  });
});
