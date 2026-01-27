# Ghostkey Governance Basics

This module introduces election-based oversight.

- Contributors nominate peers for the role of **Ethical Steward**.
- Each contributor gets one vote. The top three nominees become stewards.
- Contributors with an active soulprint receive a weight bonus on their vote.
- Stewards cannot execute protocol changes. Their sole power is freezing a proposal that breaches **truth**, **loyalty**, or **transparency**.
- Any contributor may anonymously flag a proposal. After a 24‑hour delay, flagged items are reviewed and frozen if warranted.
- Proposal status and steward votes are stored under the `governance/` directory.

## Emergency Shutdown Vote

If governance detects **system abuse**, **false beliefs**, or **partner corruption**, any steward may call `propose_shutdown`.
A majority of stewards must vote yes for the shutdown to proceed. Once approved,
all partners are paused and a transparency audit runs automatically. The
`governance/shutdown_log.json` file records every trigger condition, vote, and
audit outcome for public review.
