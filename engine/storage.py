from __future__ import annotations

import json
from pathlib import Path
from typing import Any

try:
    from sqlalchemy import Column, Integer, String, Text, create_engine
    from sqlalchemy.engine import make_url
    from sqlalchemy.orm import declarative_base, sessionmaker
except Exception:  # pragma: no cover - optional dependency
    create_engine = None  # type: ignore
    make_url = None  # type: ignore

    def Column(*args, **kwargs):  # type: ignore
        return None

    class _Dummy:
        def __init__(self, *args, **kwargs):
            pass

    Integer = String = Text = _Dummy  # type: ignore
    sessionmaker = None

    def declarative_base():  # type: ignore
        class DummyBase:
            class metadata:
                @staticmethod
                def create_all(engine):
                    pass

        return DummyBase

BASE_DIR = Path(__file__).resolve().parents[1]
CONFIG_PATH = BASE_DIR / "vaultfire_config.json"

Base = declarative_base()
_engine = None
_Session = None


def _load_config():
    if CONFIG_PATH.exists():
        try:
            with open(CONFIG_PATH) as f:
                return json.load(f)
        except json.JSONDecodeError:
            return {}
    return {}


def _init_engine():
    global _engine, _Session
    if _engine is not None:
        return
    cfg = _load_config()
    if not cfg.get("use_database"):
        return
    if create_engine is None or sessionmaker is None or make_url is None:
        raise RuntimeError(
            "SQLAlchemy is required when database usage is enabled."
        )
    url = cfg.get("database_url", "sqlite:///vaultfire.db")
    parsed = make_url(url)
    if parsed.drivername != "sqlite":
        raise ValueError("Only sqlite URLs are supported for the storage backend")
    database = parsed.database or "vaultfire.db"
    if database != ":memory:":
        db_path = Path(database)
        if not db_path.is_absolute():
            db_path = (BASE_DIR / db_path).resolve()
        db_path.parent.mkdir(parents=True, exist_ok=True)
        url = f"sqlite:///{db_path}"
    _engine = create_engine(url, future=True)
    _Session = sessionmaker(bind=_engine, future=True)
    Base.metadata.create_all(_engine)


def is_enabled() -> bool:
    cfg = _load_config()
    return bool(cfg.get("use_database"))


class KV(Base):
    __tablename__ = "kv_store"
    key = Column(String(255), primary_key=True)
    value = Column(Text)


def _read_json_file(path: Path, default: Any):
    if path.exists():
        try:
            with open(path) as f:
                return json.load(f)
        except json.JSONDecodeError:
            return default
    return default


def _write_json_file(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


def load_data(path: Path, default: Any):
    if not is_enabled():
        return _read_json_file(path, default)

    _init_engine()
    session = _Session()
    record = session.query(KV).filter_by(key=str(path)).first()
    session.close()
    if record:
        try:
            return json.loads(record.value)
        except json.JSONDecodeError:
            return default
    return _read_json_file(path, default)


def write_data(path: Path, data: Any) -> None:
    if not is_enabled():
        _write_json_file(path, data)
        return

    _init_engine()
    session = _Session()
    record = session.query(KV).filter_by(key=str(path)).first()
    data_json = json.dumps(data)
    if record:
        record.value = data_json
    else:
        record = KV(key=str(path), value=data_json)
        session.add(record)
    session.commit()
    session.close()
    _write_json_file(path, data)


class LogEntry(Base):
    __tablename__ = "log_entries"
    id = Column(Integer, primary_key=True)
    path = Column(String(255))
    entry = Column(Text)


def append_log(path: Path, entry: Any) -> None:
    if not is_enabled():
        log = _read_json_file(path, [])
        log.append(entry)
        _write_json_file(path, log)
        return

    _init_engine()
    session = _Session()
    record = LogEntry(path=str(path), entry=json.dumps(entry))
    session.add(record)
    session.commit()
    session.close()
    log = _read_json_file(path, [])
    log.append(entry)
    _write_json_file(path, log)
