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
          title: "Ember",
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
        name="verify"
        options={{
          title: "Verify",
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="shield.checkered" color={color} />,
        }}
      />
      <Tabs.Screen
        name="bridge"
        options={{
          title: "Bridge",
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="arrow.left.arrow.right" color={color} />,
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="chart.bar.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
