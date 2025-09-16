"""Shared helpers for reading and writing JSON files with locking."""
from __future__ import annotations

import json
import os
import tempfile
import threading
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

try:
    import fcntl  # type: ignore
except ImportError:  # pragma: no cover - platform fallback
    fcntl = None  # type: ignore

_LOCK_TIMEOUT = 5.0
_RETRY_DELAY = 0.05
_THREAD_LOCKS: dict[str, threading.Lock] = {}
_THREAD_LOCKS_GUARD = threading.Lock()


@contextmanager
def _thread_lock(path: Path, timeout: float) -> Iterator[None]:
    with _THREAD_LOCKS_GUARD:
        lock = _THREAD_LOCKS.setdefault(str(path), threading.Lock())
    if not lock.acquire(timeout=timeout):
        raise TimeoutError(f"Timed out acquiring lock for {path}")
    try:
        yield
    finally:
        lock.release()


@contextmanager
def _acquire_lock(path: Path, *, exclusive: bool, timeout: float) -> Iterator[None]:
    lock_path = path.with_suffix(path.suffix + '.lock')
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    if fcntl is None:  # pragma: no cover - Windows fallback
        with _thread_lock(lock_path, timeout):
            yield
        return

    with open(lock_path, 'a+', encoding='utf-8') as lock_file:
        end = time.monotonic() + timeout
        mode = fcntl.LOCK_EX if exclusive else fcntl.LOCK_SH
        while True:
            try:
                fcntl.flock(lock_file, mode | fcntl.LOCK_NB)
                break
            except BlockingIOError:
                if time.monotonic() >= end:
                    raise TimeoutError(f"Timed out acquiring lock for {path}")
                time.sleep(_RETRY_DELAY)
        try:
            yield
        finally:
            fcntl.flock(lock_file, fcntl.LOCK_UN)


def load_json(path: Path, default: Any, *, timeout: float = _LOCK_TIMEOUT) -> Any:
    """Return parsed JSON from ``path`` or ``default`` on error."""
    if not path.exists():
        return default
    try:
        with _acquire_lock(path, exclusive=False, timeout=timeout):
            with open(path, encoding='utf-8') as handle:
                return json.load(handle)
    except json.JSONDecodeError:
        return default
    except FileNotFoundError:  # pragma: no cover - race where file disappears
        return default


def write_json(path: Path, data: Any, *, timeout: float = _LOCK_TIMEOUT) -> None:
    """Atomically persist ``data`` to ``path`` in JSON format."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with _acquire_lock(path, exclusive=True, timeout=timeout):
        fd, tmp_path = tempfile.mkstemp(prefix=path.name, suffix='.tmp', dir=str(path.parent))
        try:
            with os.fdopen(fd, 'w', encoding='utf-8') as handle:
                json.dump(data, handle, indent=2)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(tmp_path, path)
        finally:
            if os.path.exists(tmp_path):  # pragma: no cover - cleanup on failure
                os.remove(tmp_path)


__all__ = ["load_json", "write_json"]
