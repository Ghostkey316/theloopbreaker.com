// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Record<SymbolViewProps["name"], ComponentProps<typeof MaterialIcons>["name"]>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * SF Symbols to Material Icons mappings.
 */
const MAPPING = {
  "house.fill": "home",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
  "bubble.left.fill": "chat",
  "shield.checkered": "verified-user",
  "arrow.left.arrow.right": "swap-horiz",
  "chart.bar.fill": "dashboard",
  "flame.fill": "local-fire-department",
  "lock.shield.fill": "security",
  "link": "link",
  "person.fill": "person",
  "wallet.pass.fill": "account-balance-wallet",
  "mic.fill": "mic",
  "speaker.wave.2.fill": "volume-up",
  "speaker.slash.fill": "volume-off",
  "bell.fill": "notifications",
  "chart.pie.fill": "pie-chart",
  "checkmark.seal.fill": "verified",
  "xmark": "close",
  "gearshape.fill": "settings",
  "square.and.arrow.up": "share",
  "doc.text.fill": "description",
  "questionmark.circle.fill": "help",
  "ellipsis": "more-horiz",
  "trash.fill": "delete",
  "stop.fill": "stop",
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 */
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
