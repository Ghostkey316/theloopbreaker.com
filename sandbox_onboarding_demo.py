import json
from pathlib import Path

from engine.identity_resolver import resolve_identity

BASE_DIR = Path(__file__).resolve().parent
PARTNERS_PATH = BASE_DIR / 'partners.json'


def onboard_partner(partner_id: str, wallet: str) -> None:
    """Add partner to partners.json if not present."""
    partners = []
    if PARTNERS_PATH.exists():
        try:
            with open(PARTNERS_PATH) as f:
                partners = json.load(f)
        except json.JSONDecodeError:
            partners = []
    if any(p.get('partner_id') == partner_id for p in partners):
        print('Partner already exists')
        return
    partners.append({'partner_id': partner_id, 'wallet': wallet})
    with open(PARTNERS_PATH, 'w') as f:
        json.dump(partners, f, indent=2)
    print(f'Onboarded partner {partner_id} with wallet {wallet}')


def test_ghostkey_recognition(identifier: str) -> None:
    """Resolve identifier and print the address."""
    address = resolve_identity(identifier)
    if address:
        print(f'{identifier} resolved to {address}')
    else:
        print(f'{identifier} not recognized')


if __name__ == '__main__':
    # Simulate onboarding using a sandbox wallet
    sandbox_partner_id = 'sandbox_partner'
    sandbox_wallet = 'bpow20.cb.id'
    onboard_partner(sandbox_partner_id, sandbox_wallet)

    # Test Ghostkey identity recognition
    test_ghostkey_recognition('ghostkey316.eth')
