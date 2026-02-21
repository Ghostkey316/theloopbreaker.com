import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");

function readFile(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf-8");
}

describe("Design Audit — Chat Experience", () => {
  const chatCode = readFile("app/(tabs)/chat.tsx");

  it("has ChatGPT-style message bubbles (user right, assistant left)", () => {
    expect(chatCode).toContain("userRow");
    expect(chatCode).toContain("assistantRow");
    expect(chatCode).toContain("userBubble");
    expect(chatCode).toContain("assistantBubble");
    expect(chatCode).toContain("justifyContent: \"flex-end\""); // user right-aligned
    expect(chatCode).toContain("alignItems: \"flex-start\""); // assistant left-aligned
  });

  it("has animated typing indicator component", () => {
    expect(chatCode).toContain("TypingIndicator");
    expect(chatCode).toContain("isTyping");
    const typingCode = readFile("components/typing-indicator.tsx");
    expect(typingCode).toContain("useSharedValue");
    expect(typingCode).toContain("withRepeat");
    expect(typingCode).toContain("translateY");
  });

  it("has markdown rendering in assistant responses", () => {
    expect(chatCode).toContain("MarkdownText");
    const mdCode = readFile("components/markdown-text.tsx");
    expect(mdCode).toContain("parseBlocks");
    expect(mdCode).toContain("code");
    expect(mdCode).toContain("bold");
    expect(mdCode).toContain("list");
    expect(mdCode).toContain("paragraph");
  });

  it("has welcome screen with suggested prompts", () => {
    expect(chatCode).toContain("SUGGESTED_PROMPTS");
    expect(chatCode).toContain("What is ERC-8004?");
    expect(chatCode).toContain("Show me the Base contracts");
    expect(chatCode).toContain("showWelcome");
    expect(chatCode).toContain("Welcome to Ember");
  });

  it("has clear chat functionality", () => {
    expect(chatCode).toContain("handleClearChat");
    expect(chatCode).toContain("Clear Conversation");
    expect(chatCode).toContain("clearChatHistory");
    expect(chatCode).toContain("clearMemories");
  });

  it("has send button that activates only with text", () => {
    expect(chatCode).toContain("disabled={!hasText || isLoading}");
    expect(chatCode).toContain("hasText && !isLoading ? colors.primary : \"transparent\"");
  });

  it("has proper keyboard avoidance", () => {
    expect(chatCode).toContain("KeyboardAvoidingView");
    expect(chatCode).toContain("keyboardVerticalOffset");
  });

  it("has auto-scroll to newest message", () => {
    expect(chatCode).toContain("scrollToEnd");
    expect(chatCode).toContain("onContentSizeChange");
  });

  it("has wallet integration modal", () => {
    expect(chatCode).toContain("walletModalVisible");
    expect(chatCode).toContain("Connect Wallet");
    expect(chatCode).toContain("Wallet Connected");
    expect(chatCode).toContain("Disconnect");
  });

  it("has message input with placeholder", () => {
    expect(chatCode).toContain("Message Ember...");
  });

  it("has disclaimer about AI accuracy", () => {
    expect(chatCode).toContain("Ember can make mistakes");
  });
});

describe("Design Audit — Theme & Branding", () => {
  const themeConfig = readFile("theme.config.js");

  it("has dark background (near-black)", () => {
    expect(themeConfig).toMatch(/#0[A-Fa-f0-9]{5}/); // dark hex color
    expect(themeConfig).toContain("0A0A0C"); // near-black
  });

  it("has ember orange primary color", () => {
    expect(themeConfig).toContain("FF6B35");
  });

  it("has warm surface color", () => {
    expect(themeConfig).toContain("161418");
  });

  it("has warm cream foreground text", () => {
    expect(themeConfig).toContain("F0E6D8");
  });

  it("has no white/light background colors", () => {
    // Background should not be white or near-white
    const bgMatch = themeConfig.match(/background:\s*\{[^}]*light:\s*'(#[A-Fa-f0-9]{6})'/);
    expect(bgMatch).toBeTruthy();
    const bgColor = bgMatch![1];
    // First two hex chars should be low (dark)
    const r = parseInt(bgColor.slice(1, 3), 16);
    expect(r).toBeLessThan(30); // Ensure it's dark
  });
});

describe("Design Audit — Status Bar", () => {
  const rootLayout = readFile("app/_layout.tsx");

  it("forces light status bar text for dark theme", () => {
    expect(rootLayout).toContain('style="light"');
  });
});

describe("Design Audit — All Screens Have Consistent Structure", () => {
  const screens = [
    "app/(tabs)/index.tsx",
    "app/(tabs)/chat.tsx",
    "app/(tabs)/verify.tsx",
    "app/(tabs)/bridge.tsx",
    "app/(tabs)/dashboard.tsx",
  ];

  screens.forEach((screen) => {
    const code = readFile(screen);
    const name = screen.split("/").pop()!.replace(".tsx", "");

    it(`${name}: uses ScreenContainer`, () => {
      expect(code).toContain("ScreenContainer");
    });

    it(`${name}: uses useColors hook`, () => {
      expect(code).toContain("useColors");
    });

    it(`${name}: uses StyleSheet.create`, () => {
      expect(code).toContain("StyleSheet.create");
    });

    it(`${name}: has animations (FadeInDown or similar)`, () => {
      expect(code).toMatch(/FadeIn|SlideIn|Animated/);
    });
  });
});

describe("Design Audit — Pull to Refresh", () => {
  const dataScreens = [
    "app/(tabs)/index.tsx",
    "app/(tabs)/verify.tsx",
    "app/(tabs)/bridge.tsx",
    "app/(tabs)/dashboard.tsx",
  ];

  dataScreens.forEach((screen) => {
    const code = readFile(screen);
    const name = screen.split("/").pop()!.replace(".tsx", "");

    it(`${name}: has RefreshControl`, () => {
      expect(code).toContain("RefreshControl");
    });

    it(`${name}: has refreshing state`, () => {
      expect(code).toContain("refreshing");
    });
  });
});

describe("Design Audit — Loading States", () => {
  const dataScreens = [
    "app/(tabs)/verify.tsx",
    "app/(tabs)/bridge.tsx",
    "app/(tabs)/dashboard.tsx",
  ];

  dataScreens.forEach((screen) => {
    const code = readFile(screen);
    const name = screen.split("/").pop()!.replace(".tsx", "");

    it(`${name}: has ActivityIndicator for loading`, () => {
      expect(code).toContain("ActivityIndicator");
    });

    it(`${name}: has loading state`, () => {
      expect(code).toContain("loading");
    });
  });
});

describe("Design Audit — Branding Elements", () => {
  const homeCode = readFile("app/(tabs)/index.tsx");
  const dashCode = readFile("app/(tabs)/dashboard.tsx");

  it("Home: has Vaultfire Protocol title", () => {
    expect(homeCode).toContain("Vaultfire Protocol");
  });

  it("Home: has Powered by Ember AI tagline", () => {
    expect(homeCode).toContain("Powered by Ember AI");
  });

  it("Home: has flame icon", () => {
    expect(homeCode).toContain("flame.fill");
  });

  it("Home: has theloopbreaker.com link", () => {
    expect(homeCode).toContain("theloopbreaker.com");
    expect(homeCode).toContain("VAULTFIRE_WEBSITE");
  });

  it("Home: displays core values", () => {
    expect(homeCode).toContain("CORE_VALUES");
  });

  it("Dashboard: displays core values", () => {
    expect(dashCode).toContain("CORE_VALUES");
  });

  it("Dashboard: has flame icon for values", () => {
    expect(dashCode).toContain("flame.fill");
  });
});

describe("Design Audit — Tab Navigation", () => {
  const tabLayout = readFile("app/(tabs)/_layout.tsx");

  it("has all 5 tabs defined", () => {
    expect(tabLayout).toContain('name="index"');
    expect(tabLayout).toContain('name="chat"');
    expect(tabLayout).toContain('name="verify"');
    expect(tabLayout).toContain('name="bridge"');
    expect(tabLayout).toContain('name="dashboard"');
  });

  it("has correct tab titles", () => {
    expect(tabLayout).toContain('title: "Home"');
    expect(tabLayout).toContain('title: "Ember"');
    expect(tabLayout).toContain('title: "Verify"');
    expect(tabLayout).toContain('title: "Bridge"');
    expect(tabLayout).toContain('title: "Dashboard"');
  });

  it("uses primary color for active tint", () => {
    expect(tabLayout).toContain("colors.primary");
  });

  it("uses haptic feedback on tabs", () => {
    expect(tabLayout).toContain("HapticTab");
  });
});

describe("Design Audit — Markdown Renderer", () => {
  const mdCode = readFile("components/markdown-text.tsx");

  it("handles code blocks with language labels", () => {
    expect(mdCode).toContain("language");
    expect(mdCode).toContain("textTransform: \"uppercase\"");
  });

  it("handles bold text", () => {
    expect(mdCode).toContain("fontWeight: \"700\"");
    expect(mdCode).toContain("bold");
  });

  it("handles inline code", () => {
    expect(mdCode).toContain("fontFamily: \"monospace\"");
    expect(mdCode).toContain("code");
  });

  it("handles bullet lists", () => {
    expect(mdCode).toContain("•");
    expect(mdCode).toContain("list");
  });

  it("handles numbered lists", () => {
    expect(mdCode).toContain("\\d+\\.\\s+");
  });
});

describe("Design Audit — Typing Indicator", () => {
  const typingCode = readFile("components/typing-indicator.tsx");

  it("has 3 animated dots", () => {
    // Three Dot components with different delays
    expect(typingCode).toContain("delay={0}");
    expect(typingCode).toContain("delay={150}");
    expect(typingCode).toContain("delay={300}");
  });

  it("uses bounce animation", () => {
    expect(typingCode).toContain("translateY");
    expect(typingCode).toContain("withSequence");
    expect(typingCode).toContain("withRepeat");
  });

  it("has proper dot styling", () => {
    expect(typingCode).toContain("width: 8");
    expect(typingCode).toContain("height: 8");
    expect(typingCode).toContain("borderRadius: 4");
  });
});
