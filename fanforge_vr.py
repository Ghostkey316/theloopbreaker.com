from pathlib import Path
import json
from datetime import datetime
import ghostseat
from engine.proof_of_loyalty import record_belief_action

LOG_PATH = Path('fanforge_vr_log.json')


def vr_check_in(identity: str, team: str) -> str:
    seat = ghostseat.assign_seat(identity, team)
    ghostseat.log_reaction(identity, seat, 'checkin')
    record_belief_action(identity, identity, f'{team} check-in')
    try:
        log = json.loads(LOG_PATH.read_text())
    except Exception:
        log = []
    log.append({'timestamp': datetime.utcnow().isoformat(), 'identity': identity, 'team': team})
    LOG_PATH.write_text(json.dumps(log, indent=2))
    return seat


def record_memory(identity: str, text: str) -> None:
    record_belief_action(identity, identity, text)
