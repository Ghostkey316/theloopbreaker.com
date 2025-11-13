"""Initialize the Vaultfire v25+ expansion stack.

- This repository is alpha-stage software; expect breaking changes and incomplete hardening.
- Ambient data gathering requires opt-in consent from participants.
- No module in this repository offers medical or legal advice.
- System logs may store limited personal data for reflective analysis.
- Partnerships are currently simulated; integration examples run in sandbox environments only.
- Plugin support is provided as-is with no guarantee of compatibility or continued maintenance.
- Partners must perform their own compliance review before experimenting.
- Vaultfire modules may change without notice and are provided as-is.
- Nothing in this repository constitutes financial advice.
"""

from __future__ import annotations

from vaultfire import echo, growth, satellite


user_identity = {
    "wallet": "bpow20.cb.id",
    "ens": "ghostkey316.eth",
    "legacyTier": True,
    "syncMode": "full",
    "behaviorTracking": True,
    "ethicsVerified": True,
    "beliefDensity": 0.74,
    "missionTags": ["Vaultfire", "NS3", "Ghostkey-316"],
    "declaredPurpose": "Sustain Vaultfire, NS3, and Ghostkey-316 mission threads with belief-aligned scale",
}


def main() -> None:
    echo.deploy_companion(user_identity)
    growth.prepare_v26(
        user_identity,
        enableMultipliers=True,
        enableOpenAISync=True,
        yieldRewards=True,
    )
    satellite.deploy_lite_fork(
        user_identity,
        restrictAdminAccess=True,
        allowReferral=True,
        passiveTracking=True,
    )
    print("\u2705 Vaultfire Expansion Stack (Steps 1\u20134) Initialized")


if __name__ == "__main__":
    main()
