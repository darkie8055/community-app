import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSnapshot } from "../context";
import { colors, Icon, Row, Text } from "../ui";
import { useResidentNavigation } from "./components";

export function ResidentToolbar({ isTab }: { isTab: boolean }) {
  const nav = useResidentNavigation();
  const snapshot = useSnapshot();
  const unread = snapshot.notifications.some((item) => !item.read_at);
  return (
    <Row style={t.bar}>
      {!isTab && nav.canGoBack() ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => nav.goBack()}
          style={t.icon}
        >
          <Icon name="arrow-left" />
        </Pressable>
      ) : (
        <View style={t.mark}>
          <Icon name="home-variant-outline" size={22} color={colors.yellow} />
        </View>
      )}
      <Text style={t.brand}>My Home</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Notifications"
        onPress={() => nav.navigate("Notifications")}
        style={t.icon}
      >
        <Icon name="bell-outline" />
        {unread && <View style={t.dot} />}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="My profile"
        onPress={() => nav.navigate("Profile")}
        style={t.icon}
      >
        <View style={t.avatar}>
          <Text style={t.initial}>{snapshot.user?.name?.[0] ?? "M"}</Text>
        </View>
      </Pressable>
    </Row>
  );
}

const t = StyleSheet.create({
  bar: {
    minHeight: 54,
    paddingHorizontal: 18,
    gap: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  mark: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.teal,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: { flex: 1, fontWeight: "800", fontSize: 19, letterSpacing: -0.7 },
  icon: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    position: "absolute",
    width: 8,
    height: 8,
    backgroundColor: colors.yellow,
    borderWidth: 1,
    borderColor: colors.teal,
    borderRadius: 5,
    right: 10,
    top: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.mint,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { color: colors.teal, fontWeight: "800" },
});
