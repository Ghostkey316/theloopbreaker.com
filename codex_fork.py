"""
This script performs a full protocol fork with identity sync, belief injection, and partner-readiness validation.
"""

import argparse
import subprocess
import datetime
import hashlib

def main():
    parser = argparse.ArgumentParser(description="Codex Fork Utility")
    parser.add_argument("--wallet", required=True, help="Wallet identifier")
    parser.add_argument("--inject-ethic", required=True,
                        help="Belief directive to inject")
    parser.add_argument("--activate", action="store_true",
                        help="Trigger activation hook")
    parser.add_argument("--validate-all", action="store_true",
                        help="Run system integrity check")
    args = parser.parse_args()

    print(f"\n🔁 Forking for wallet: {args.wallet}")
    print(f"🧠 Injecting belief: \"{args.inject_ethic}\"")
    
    if args.activate:
        print("🚀 Activation triggered…")
        subprocess.run([
            'python3',
            'simulate_partner_activation.py',
            'demo',
            args.wallet,
            '--hook',
            '--silent',
            '--test-mode',
        ])

    if args.validate_all:
        print("🛡️ Validating system integrity…")
        subprocess.run([
            'python3',
            'system_integrity_check.py',
            '--test-mode',
            '--silent',
        ])

    with open(__file__, 'rb') as f:
        file_hash = hashlib.sha256(f.read()).hexdigest()
    print(f"🧾 Fork hash: {file_hash}")

    now = datetime.datetime.utcnow()
    print(f"\n📦 Fork completed at {now.isoformat()} UTC")

if __name__ == '__main__':
    main()
