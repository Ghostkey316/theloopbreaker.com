from mirror_log import log_sample, self_audit_template
from vaultfire import rewards
from memory_graph import update_graph
from moral_alignment import evaluate_entry
from utils import get_timestamp


MENU_TEXT = "💠 Welcome to Humanity Mirror\n1. Daily Reflection  2. Self-Audit  3. Exit"


def _handle_reflection() -> None:
    entry = input("Reflect freely (feelings, choices, doubts):\n")
    timestamp = get_timestamp()

    alignment = evaluate_entry(entry)
    graph_node = update_graph(
        entry,
        timestamp=timestamp,
        alignment_score=alignment.get("normalized"),
    )
    log_sample(
        entry,
        timestamp,
        tags=graph_node.get("themes"),
        alignment_score=alignment.get("normalized"),
    )
    rewards.calculate(
        entry,
        alignment=alignment,
        graph_node=graph_node,
        timestamp=timestamp,
    )


def _handle_self_audit() -> None:
    print(self_audit_template())


def get_user_input():
    print(MENU_TEXT)
    choice = input("Choose (1/2/3): ")

    if choice == "1":
        _handle_reflection()
    elif choice == "2":
        _handle_self_audit()
    else:
        print("Goodbye.")


if __name__ == "__main__":
    get_user_input()
