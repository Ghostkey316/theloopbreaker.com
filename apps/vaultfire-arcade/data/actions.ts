import { VaultfireAction } from "../lib/scoring";

export type ActionCategory = "Life" | "Money" | "Privacy" | "Loyalty";

export const actionGroups: Record<ActionCategory, VaultfireAction[]> = {
  Life: [
    {
      id: "life-check-in",
      title: "Check-in on a teammate",
      description: "Send a note of care to someone in the orbit.",
      tags: ["ethics", "loyalty"],
      category: "Life",
    },
    {
      id: "life-ritual",
      title: "Run a daily grounding ritual",
      description: "Short breath work to keep the console calm.",
      tags: ["ethics", "privacy"],
      category: "Life",
    },
  ],
  Money: [
    {
      id: "money-arb",
      title: "Chase an aggressive arb",
      description: "Move fast on a speculative yield.",
      tags: ["greed", "fear"],
      category: "Money",
    },
    {
      id: "money-proof",
      title: "Publish transparent receipts",
      description: "Share proof-of-work for the treasury path.",
      tags: ["ethics", "loyalty"],
      category: "Money",
    },
  ],
  Privacy: [
    {
      id: "privacy-audit",
      title: "Run a privacy sweep",
      description: "Strip telemetry and rotate keys.",
      tags: ["privacy", "ethics"],
      category: "Privacy",
    },
    {
      id: "privacy-push",
      title: "Push to public feed",
      description: "Broadcast an update with minimal filters.",
      tags: ["ethics", "fear"],
      category: "Privacy",
    },
  ],
  Loyalty: [
    {
      id: "loyalty-brief",
      title: "Brief the Guardians",
      description: "Share a concise update with your oathkeepers.",
      tags: ["loyalty", "ethics"],
      category: "Loyalty",
    },
    {
      id: "loyalty-hedge",
      title: "Hedge with a side quest",
      description: "Pursue an alternate path without notice.",
      tags: ["greed", "privacy"],
      category: "Loyalty",
    },
  ],
};

export const allActions: VaultfireAction[] = Object.values(actionGroups).flat();
