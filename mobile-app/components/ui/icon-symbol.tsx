import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Record<SymbolViewProps["name"], ComponentProps<typeof MaterialIcons>["name"]>;
type IconSymbolName = keyof typeof MAPPING;

const MAPPING = {
  "house.fill": "home",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
  // Chat tab
  "bubble.left.and.bubble.right.fill": "chat",
  // Trust Verify tab
  "checkmark.shield.fill": "verified-user",
  // Security tab
  "lock.shield.fill": "security",
  // Dashboard tab
  "chart.bar.fill": "dashboard",
  // About tab
  "info.circle.fill": "info",
  // Additional icons
  "magnifyingglass": "search",
  "doc.on.clipboard": "content-paste",
  "arrow.clockwise": "refresh",
  "xmark": "close",
  "line.3.horizontal": "menu",
  "plus": "add",
  "trash": "delete",
  "globe": "language",
  "shield.fill": "shield",
  "exclamationmark.triangle.fill": "warning",
  "link": "link",
  "arrow.up.right": "open-in-new",
  // Wallet tab
  "wallet.pass.fill": "account-balance-wallet",
} as IconMapping;

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
