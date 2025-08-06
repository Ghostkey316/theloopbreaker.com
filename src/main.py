from mirror_log import log_sample, self_audit_template
from vaultfire import rewards
from memory_graph import update_graph
from moral_alignment import evaluate_entry
from utils import get_timestamp


def get_user_input():
    print("\U0001F4A0 Welcome to Humanity Mirror")
    print("1. Daily Reflection  2. Self-Audit  3. Exit")
    choice = input("Choose (1/2/3): ")

    if choice == "1":
        entry = input("Reflect freely (feelings, choices, doubts):\n")
        timestamp = get_timestamp()
        with open("mirror_log/log_sample.md", "a") as f:
            f.write(f"\n## {timestamp}\n{entry}\n")
        update_graph(entry)
        evaluate_entry(entry)
        rewards.calculate(entry)

    elif choice == "2":
        with open("mirror_log/self_audit_template.md", "r") as f:
            print(f.read())
    else:
        print("Goodbye.")


if __name__ == "__main__":
    get_user_input()
