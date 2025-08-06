def evaluate_entry(entry):
    keywords = ["honest", "grateful", "selfish", "hopeful", "afraid"]
    score = sum(1 for word in keywords if word in entry.lower())
    print(f"\U0001F9ED Moral alignment score: {score}/5 — Integrity signal logged.")
