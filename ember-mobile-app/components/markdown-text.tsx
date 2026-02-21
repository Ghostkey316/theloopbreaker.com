/**
 * Simple Markdown-like renderer for chat messages.
 * Handles: **bold**, `inline code`, ```code blocks```, - lists, and paragraphs.
 * No external dependencies — pure React Native.
 */
import { Text, View, StyleSheet } from "react-native";
import { useMemo } from "react";

interface MarkdownTextProps {
  text: string;
  baseColor: string;
  codeBackground: string;
  codeBorderColor: string;
  accentColor: string;
}

interface Block {
  type: "paragraph" | "code" | "list";
  content: string;
  language?: string;
  items?: string[];
}

function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  const lines = text.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.trimStart().startsWith("```")) {
      const lang = line.trimStart().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({ type: "code", content: codeLines.join("\n"), language: lang || undefined });
      i++; // skip closing ```
      continue;
    }

    // List items (- or *)
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      blocks.push({ type: "list", content: "", items });
      continue;
    }

    // Numbered list items
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      blocks.push({ type: "list", content: "", items });
      continue;
    }

    // Empty line — skip
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraph: collect until empty line or special block
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].trimStart().startsWith("```") &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: "paragraph", content: paraLines.join(" ") });
    }
  }

  return blocks;
}

/** Render inline markdown: **bold** and `code` */
function InlineText({
  text,
  baseColor,
  codeBackground,
  accentColor,
}: {
  text: string;
  baseColor: string;
  codeBackground: string;
  accentColor: string;
}) {
  // Split on **bold** and `code` patterns
  const parts: { text: string; bold?: boolean; code?: boolean }[] = [];
  const regex = /(\*\*(.+?)\*\*|`([^`]+)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index) });
    }
    if (match[2]) {
      parts.push({ text: match[2], bold: true });
    } else if (match[3]) {
      parts.push({ text: match[3], code: true });
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex) });
  }

  return (
    <Text style={{ color: baseColor, fontSize: 15, lineHeight: 22 }}>
      {parts.map((part, idx) => {
        if (part.bold) {
          return (
            <Text key={idx} style={{ fontWeight: "700", color: baseColor }}>
              {part.text}
            </Text>
          );
        }
        if (part.code) {
          return (
            <Text
              key={idx}
              style={{
                fontFamily: "monospace",
                fontSize: 13,
                backgroundColor: codeBackground,
                color: accentColor,
                paddingHorizontal: 2,
              }}
            >
              {part.text}
            </Text>
          );
        }
        return <Text key={idx}>{part.text}</Text>;
      })}
    </Text>
  );
}

export function MarkdownText({ text, baseColor, codeBackground, codeBorderColor, accentColor }: MarkdownTextProps) {
  const blocks = useMemo(() => parseBlocks(text), [text]);

  return (
    <View style={{ gap: 8 }}>
      {blocks.map((block, idx) => {
        if (block.type === "code") {
          return (
            <View
              key={idx}
              style={{
                backgroundColor: codeBackground,
                borderRadius: 8,
                padding: 12,
                borderWidth: 1,
                borderColor: codeBorderColor,
              }}
            >
              {block.language ? (
                <Text
                  style={{
                    color: accentColor,
                    fontSize: 10,
                    fontWeight: "600",
                    marginBottom: 6,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  {block.language}
                </Text>
              ) : null}
              <Text
                style={{
                  fontFamily: "monospace",
                  fontSize: 13,
                  lineHeight: 19,
                  color: baseColor,
                }}
              >
                {block.content}
              </Text>
            </View>
          );
        }

        if (block.type === "list" && block.items) {
          return (
            <View key={idx} style={{ gap: 4, paddingLeft: 4 }}>
              {block.items.map((item, i) => (
                <View key={i} style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                  <Text style={{ color: accentColor, fontSize: 15, lineHeight: 22 }}>•</Text>
                  <View style={{ flex: 1 }}>
                    <InlineText
                      text={item}
                      baseColor={baseColor}
                      codeBackground={codeBackground}
                      accentColor={accentColor}
                    />
                  </View>
                </View>
              ))}
            </View>
          );
        }

        // Paragraph
        return (
          <InlineText
            key={idx}
            text={block.content}
            baseColor={baseColor}
            codeBackground={codeBackground}
            accentColor={accentColor}
          />
        );
      })}
    </View>
  );
}
