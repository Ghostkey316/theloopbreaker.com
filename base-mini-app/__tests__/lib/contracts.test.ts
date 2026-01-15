import { getModuleName, getModuleColor, MODULE_IDS, areContractsConfigured } from '@/lib/contracts';

describe('Contract utilities', () => {
  describe('getModuleName', () => {
    it('returns correct name for GitHub module', () => {
      expect(getModuleName(MODULE_IDS.GITHUB)).toBe('GitHub');
    });

    it('returns correct name for NS3 module', () => {
      expect(getModuleName(MODULE_IDS.NS3)).toBe('NS3');
    });

    it('returns correct name for Base module', () => {
      expect(getModuleName(MODULE_IDS.BASE)).toBe('Base');
    });

    it('returns "Generic" for unknown module', () => {
      expect(getModuleName(999)).toBe('Generic');
    });
  });

  describe('getModuleColor', () => {
    it('returns correct color class for GitHub', () => {
      expect(getModuleColor(MODULE_IDS.GITHUB)).toContain('bg-gray-900');
    });

    it('returns correct color class for NS3', () => {
      expect(getModuleColor(MODULE_IDS.NS3)).toContain('bg-vaultfire-purple');
    });

    it('returns correct color class for Base', () => {
      expect(getModuleColor(MODULE_IDS.BASE)).toContain('bg-base-blue');
    });

    it('returns default color for unknown module', () => {
      expect(getModuleColor(999)).toContain('bg-base-gray-600');
    });
  });

  describe('areContractsConfigured', () => {
    it('returns false when contracts are not configured (all zeros)', () => {
      // Default state without environment variables
      expect(areContractsConfigured()).toBe(false);
    });
  });

  describe('MODULE_IDS', () => {
    it('has correct module ID values', () => {
      expect(MODULE_IDS.GENERIC).toBe(0);
      expect(MODULE_IDS.GITHUB).toBe(1);
      expect(MODULE_IDS.NS3).toBe(2);
      expect(MODULE_IDS.BASE).toBe(3);
    });
  });
});
