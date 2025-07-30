"""Convert JSON data files and logs to the database backend."""
from pathlib import Path
import json
from engine import storage

FILES = [
    Path("partners.json"),
    Path("user_list.json"),
    Path("earners.json"),
    Path("user_scorecard.json"),
    Path("og_loyalists.json"),
    Path("vaultfire-core") / "ethics" / "morals_audit_log.json",
    Path("logs") / "passive_yield.json",
]

def migrate_file(path: Path):
    if not path.exists():
        return
    try:
        with open(path) as f:
            data = json.load(f)
    except json.JSONDecodeError:
        return
    if isinstance(data, list) or isinstance(data, dict):
        storage.write_data(path, data)
    else:
        for entry in data:
            storage.append_log(path, entry)
    print(f"migrated {path}")


def main():
    if not storage.is_enabled():
        print("Database not enabled in configuration")
        return
    for f in FILES:
        migrate_file(Path(f))


if __name__ == "__main__":
    main()
