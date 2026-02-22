import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform, View, StyleSheet } from "react-native";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  const tabBarHeight = 56 + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#FAFAFA",
        tabBarInactiveTintColor: "#3F3F46",
        headerShown: false,
        tabBarButton: HapticTab,
        // Smooth tab transitions
        animation: "fade",
        tabBarStyle: {
          paddingTop: 8,
          paddingBottom: bottomPadding,
          height: tabBarHeight,
          backgroundColor: "#09090B",
          borderTopColor: "rgba(255,255,255,0.04)",
          borderTopWidth: 1,
          // Subtle shadow for depth
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -1 },
          shadowOpacity: 0.15,
          shadowRadius: 4,
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "500",
          letterSpacing: 0.2,
          marginTop: 2,
        },
        tabBarIconStyle: {
          marginTop: 2,
        },
        // Active tab indicator
        tabBarActiveBackgroundColor: "transparent",
        tabBarInactiveBackgroundColor: "transparent",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Embris",
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol
              size={focused ? 25 : 23}
              name="bubble.left.and.bubble.right.fill"
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: "Wallet",
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol
              size={focused ? 25 : 23}
              name="wallet.pass.fill"
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="trust-verify"
        options={{
          title: "Trust",
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol
              size={focused ? 25 : 23}
              name="checkmark.shield.fill"
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="security"
        options={{
          title: "Security",
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol
              size={focused ? 25 : 23}
              name="lock.shield.fill"
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol
              size={focused ? 25 : 23}
              name="chart.bar.fill"
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="about"
        options={{
          title: "About",
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol
              size={focused ? 25 : 23}
              name="info.circle.fill"
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol
              size={focused ? 25 : 23}
              name="gear"
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
