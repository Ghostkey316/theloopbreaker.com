import json
from pathlib import Path

from onboarding_api import app
from engine.revenue_hooks import record_contract_revenue
from engine.belief_validation import validate_belief


BASE_DIR = Path(__file__).resolve().parent


def run_sandbox():
    partner_id = "belieftech"
    wallet = "belieftech.eth"
    statement = "We believe in truth over hype"

    # API call: onboard partner
    with app.test_client() as client:
        res = client.post("/onboard/partner", json={"partner_id": partner_id, "wallet": wallet})
        print("Onboard Response:", res.json)

    # Ethics verification
    ethics_ok = validate_belief(partner_id, statement)
    print("Ethics Verification:", ethics_ok)

    # Smart contract callback simulation
    entry = record_contract_revenue("0xBeliefTechContract", 5000.0, "ASM")
    print("Contract Revenue Entry:")
    print(json.dumps(entry, indent=2))


if __name__ == "__main__":
    run_sandbox()
