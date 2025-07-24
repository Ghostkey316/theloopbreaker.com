from importlib import import_module
from pathlib import Path

PLUGIN_DIR = Path(__file__).resolve().parent

__all__ = []
plugins = {}

for path in PLUGIN_DIR.glob('*.py'):
    if path.stem == '__init__':
        continue
    try:
        module = import_module(f'partner_plugins.{path.stem}')
        plugins[path.stem] = module
        for name in getattr(module, '__all__', []):
            globals()[name] = getattr(module, name)
            __all__.append(name)
    except Exception:
        continue

def load_plugins():
    """Return loaded plugin modules."""
    return plugins
