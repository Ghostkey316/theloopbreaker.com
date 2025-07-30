import re
from pathlib import Path


def print_tokens(file_path: str = 'YIELD_PROTOCOL.md') -> None:
    path = Path(__file__).resolve().parent / file_path
    with path.open('r', encoding='utf-8') as f:
        for line in f:
            tokens = re.findall(r'\b\w+\b', line)
            if tokens:
                print(' '.join(tokens))
            else:
                print('')


if __name__ == '__main__':
    print_tokens()
