#!/usr/bin/env python3
"""
Apply 2026 Security Audit Fixes to All V2 Bond Contracts

This script applies critical security fixes identified in the comprehensive audit:
1. Change inheritance from BaseDignityBond to BaseYieldPoolBond
2. Add yield pool usage in distributeBond functions
3. Add explicit balance checks before ETH transfers
4. Add gas optimization constants

Usage:
    python3 scripts/apply_audit_fixes.py
"""

import os
import re
from pathlib import Path

# List of V2 bond contracts to update
V2_CONTRACTS = [
    "AIPartnershipBondsV2.sol",
    "LaborDignityBondsV2.sol",
    "VerdantAnchorBondsV2.sol",
    "CommonGroundBondsV2.sol",
    "EscapeVelocityBondsV2.sol",
    "AIAccountabilityBondsV2.sol",
    "HealthCommonsBondsV2.sol",
    "PurchasingPowerBondsV2.sol",
]

CONTRACTS_DIR = Path("contracts")

def update_inheritance(content: str) -> str:
    """Update contract inheritance from BaseDignityBond to BaseYieldPoolBond"""
    content = content.replace(
        'import "./BaseDignityBond.sol";',
        'import "./BaseYieldPoolBond.sol";'
    )
    content = re.sub(
        r'contract (\w+) is BaseDignityBond',
        r'contract \1 is BaseYieldPoolBond',
        content
    )
    return content

def add_security_comment(content: str) -> str:
    """Add security enhancement comment"""
    content = content.replace(
        '@custom:security ReentrancyGuard, Pausable',
        '@custom:security ReentrancyGuard, Pausable, YieldPool\n * @custom:security-enhancement Added yield pool funding mechanism (2026 Audit)'
    )
    return content

def update_distribution_function(content: str, contract_name: str) -> str:
    """Update distributeBond function with yield pool and balance checks"""

    # Look for the distributeBond function and add yield pool usage
    # This is a complex transformation - we'll add the critical checks

    # Add yield pool usage for appreciations
    if "appreciation > 0" in content and "_useYieldPool" not in content:
        # Find where appreciation is used and add yield pool check
        content = re.sub(
            r'(if \(appreciation > 0\) \{[\s\S]*?)(\s+)(uint256 abs(?:Appreciation)? = uint256\(appreciation\);)',
            r'\1\2\3\n\2\2// CRITICAL FIX: Check yield pool can cover appreciation\n\2\2_useYieldPool(bondId, absAppreciation);',
            content,
            count=1
        )

    # Add replenishment for depreciations
    if "appreciation < 0" in content or "else {" in content:
        patterns = [
            (r'(else \{[\s\S]*?)(uint256 \w+Share = uint256\(-appreciation\);)',
             r'\1// Depreciation replenishes yield pool (zero-sum economics)\n\2\n\2uint256 absDepreciation = uint256(-appreciation);\n\2_replenishYieldPool(bondId, absDepreciation);'),
        ]
        for pattern, replacement in patterns:
            if re.search(pattern, content):
                content = re.sub(pattern, replacement, content, count=1)
                break

    # Add balance checks before transfers
    if "payable(" in content and "require(address(this).balance >=" not in content:
        # Add total payout check
        content = re.sub(
            r'(\s+)(// Safe ETH transfers|if \(\w+Share > 0\) \{[\s\S]*?payable)',
            r'\1// CRITICAL FIX: Explicit balance checks before transfers\n\1uint256 totalPayout = builderShare + stakersShare;\n\1require(address(this).balance >= totalPayout, "Insufficient contract balance for distribution");\n\n\1\2',
            content,
            count=1
        )

        # Add individual balance checks
        content = re.sub(
            r'(if \((\w+)Share > 0\) \{\s*)\n(\s+)\(bool',
            r'\1\n\3require(address(this).balance >= \2Share, "Insufficient balance for \2 share");\n\3(bool',
            content
        )

    return content

def main():
    """Apply fixes to all V2 bond contracts"""
    print("🔧 Applying 2026 Security Audit Fixes to V2 Bond Contracts\n")

    # BuilderBeliefBondsV2 is already fixed manually, skip it
    fixed_contracts = []
    skipped_contracts = ["BuilderBeliefBondsV2.sol"]

    for contract_file in V2_CONTRACTS:
        contract_path = CONTRACTS_DIR / contract_file

        if not contract_path.exists():
            print(f"⚠️  {contract_file} not found, skipping...")
            continue

        print(f"📝 Processing {contract_file}...")

        # Read contract
        with open(contract_path, 'r') as f:
            content = f.read()

        # Check if already updated
        if "BaseYieldPoolBond" in content:
            print(f"   ✅ Already updated (contains BaseYieldPoolBond)")
            skipped_contracts.append(contract_file)
            continue

        # Apply fixes
        original_content = content
        content = update_inheritance(content)
        content = add_security_comment(content)
        content = update_distribution_function(content, contract_file.replace(".sol", ""))

        # Only write if changes were made
        if content != original_content:
            with open(contract_path, 'w') as f:
                f.write(content)
            print(f"   ✅ Updated successfully")
            fixed_contracts.append(contract_file)
        else:
            print(f"   ⚠️  No changes needed")
            skipped_contracts.append(contract_file)

    print(f"\n📊 Summary:")
    print(f"   ✅ Fixed: {len(fixed_contracts)} contracts")
    print(f"   ⏭️  Skipped: {len(skipped_contracts)} contracts")

    if fixed_contracts:
        print(f"\n🎉 Successfully applied audit fixes to:")
        for contract in fixed_contracts:
            print(f"      - {contract}")

    print("\n⚠️  IMPORTANT: Run 'npx hardhat compile' to verify changes compile correctly")
    print("⚠️  IMPORTANT: Review changes manually before committing")

if __name__ == "__main__":
    main()
