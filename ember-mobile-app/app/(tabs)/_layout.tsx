import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Platform } from "react-native";
import { useColors } from "@/hooks/use-colors";

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  const tabBarHeight = 56 + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarLabelStyle: {
          fontSize: 10,
        },
        tabBarStyle: {
          paddingTop: 6,
          paddingBottom: bottomPadding,
          height: tabBarHeight,
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
        },
      }}
    >
      {/* ── Primary Tabs (visible in tab bar) ── */}
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Embris",
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="bubble.left.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: "Wallet",
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="wallet.pass.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="agent-hub"
        options={{
          title: "Hub",
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="person.3.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "More",
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="ellipsis.circle.fill" color={color} />,
        }}
      />

      {/* ── Secondary Screens (hidden from tab bar, accessible via navigation) ── */}
      <Tabs.Screen
        name="trust"
        options={{
          title: "Trust",
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="checkmark.seal.fill" color={color} />,
          href: null,
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: "Analytics",
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="chart.pie.fill" color={color} />,
          href: null,
        }}
      />
      <Tabs.Screen
        name="verify"
        options={{
          title: "Verify",
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="shield.checkered" color={color} />,
          href: null,
        }}
      />
      <Tabs.Screen
        name="bridge"
        options={{
          title: "Bridge",
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="arrow.left.arrow.right" color={color} />,
          href: null,
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="chart.bar.fill" color={color} />,
          href: null,
        }}
      />
      <Tabs.Screen
        name="vns"
        options={{
          title: "VNS",
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="link" color={color} />,
          href: null,
        }}
      />
      <Tabs.Screen
        name="zk-proofs"
        options={{
          title: "ZK Proofs",
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="lock.shield.fill" color={color} />,
          href: null,
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: "Earnings",
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="chart.line.uptrend.xyaxis" color={color} />,
          href: null,
        }}
      />
      <Tabs.Screen
        name="agent-api"
        options={{
          title: "API",
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="terminal.fill" color={color} />,
          href: null,
        }}
      />
    </Tabs>
  );
}
