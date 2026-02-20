import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";

describe("Ember router", () => {
  it("should have ember procedures defined", () => {
    const procedures = Object.keys((appRouter as any)._def.procedures);
    expect(procedures).toContain("ember.sendMessage");
    expect(procedures).toContain("ember.quickSend");
    expect(procedures).toContain("ember.listConversations");
    expect(procedures).toContain("ember.createConversation");
    expect(procedures).toContain("ember.deleteConversation");
    expect(procedures).toContain("ember.getMessages");
  });

  it("should still have auth procedures", () => {
    const procedures = Object.keys((appRouter as any)._def.procedures);
    expect(procedures).toContain("auth.me");
    expect(procedures).toContain("auth.logout");
  });
});
