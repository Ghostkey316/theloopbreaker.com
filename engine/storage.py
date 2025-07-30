from __future__ import annotations
import json
from pathlib import Path
from typing import Any

from sqlalchemy import create_engine, Column, Integer, String, Text
from sqlalchemy.orm import sessionmaker, declarative_base

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
    url = cfg.get("database_url", "sqlite:///vaultfire.db")
    _engine = create_engine(url)
    _Session = sessionmaker(bind=_engine)
    Base.metadata.create_all(_engine)


def is_enabled() -> bool:
    cfg = _load_config()
    return bool(cfg.get("use_database"))


class KV(Base):
    __tablename__ = "kv_store"
    key = Column(String(255), primary_key=True)
    value = Column(Text)


def load_data(path: Path, default: Any):
    if not is_enabled():
        if path.exists():
            try:
                with open(path) as f:
                    return json.load(f)
            except json.JSONDecodeError:
                return default
        return default

    _init_engine()
    session = _Session()
    record = session.query(KV).filter_by(key=str(path)).first()
    session.close()
    if record:
        try:
            return json.loads(record.value)
        except json.JSONDecodeError:
            return default
    return default


def write_data(path: Path, data: Any) -> None:
    if not is_enabled():
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w") as f:
            json.dump(data, f, indent=2)
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


class LogEntry(Base):
    __tablename__ = "log_entries"
    id = Column(Integer, primary_key=True)
    path = Column(String(255))
    entry = Column(Text)


def append_log(path: Path, entry: Any) -> None:
    if not is_enabled():
        log = []
        if path.exists():
            try:
                with open(path) as f:
                    log = json.load(f)
            except json.JSONDecodeError:
                log = []
        log.append(entry)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w") as f:
            json.dump(log, f, indent=2)
        return

    _init_engine()
    session = _Session()
    record = LogEntry(path=str(path), entry=json.dumps(entry))
    session.add(record)
    session.commit()
    session.close()
