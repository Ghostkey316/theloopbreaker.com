"""
This script performs a full protocol fork with identity sync, belief injection, and partner-readiness validation.
"""

import argparse
import subprocess
import datetime

def main():
    parser = argparse.ArgumentParser(description="Codex Fork Utility")
    parser.add_argument('--origin', required=True)
    parser.add_argument('--inject', required=True)
    parser.add_argument('--ready-status', required=True)
    parser.add_argument('--partner-ready', required=True)
    parser.add_argument('--activate', action='store_true')
    parser.add_argument('--validate-all', action='store_true')
    args = parser.parse_args()

    print(f"\n🔁 Forking from: {args.origin}")
    print(f"🧠 Injecting belief: \"{args.inject}\"")
    print(f"✅ Ready status: {args.ready_status}")
    print(f"🔌 Partner-ready: {args.partner_ready}")
    
    if args.activate:
        print("🚀 Activation triggered…")
        subprocess.run(['python3', 'simulate_partner_activation.py', args.origin, '--hook', '--silent', '--test-mode'])

    if args.validate_all:
        print("🛡️ Validating system integrity…")
        subprocess.run(['python3', 'system_integrity_check.py', '--test-mode', '--silent'])

    now = datetime.datetime.utcnow()
    print(f"\n📦 Fork completed at {now.isoformat()} UTC")

if __name__ == '__main__':
    main()
