import React from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  View,
  type ImageSourcePropType,
} from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { Routes } from "../context";
import { colors, Icon, Row, s, Text } from "../ui";

export const useResidentNavigation = () =>
  useNavigation<NativeStackNavigationProp<Routes>>();
export type IconName = React.ComponentProps<typeof Icon>["name"];

export const neighbourhood = require("../../assets/images/resident/neighbourhood.jpg");
export const gatehouse = require("../../assets/images/resident/gatehouse.jpg");
export const courtyard = require("../../assets/images/resident/courtyard.jpg");

export function TextAction({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.textAction}
    >
      <Text style={styles.link}>{label}</Text>
      <Icon name="chevron-right" size={16} color={colors.teal} />
    </Pressable>
  );
}

export function Section({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <Row style={styles.section}>
      <Text accessibilityRole="header" style={[s.title, { flex: 1 }]}>
        {title}
      </Text>
      {action}
    </Row>
  );
}

export function ActionTile({
  label,
  icon,
  onPress,
  accent = false,
}: {
  label: string;
  icon: IconName;
  onPress: () => void;
  accent?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && { opacity: 0.65 }]}
    >
      <View
        style={[
          styles.tileIcon,
          accent && {
            backgroundColor: colors.yellow,
            borderColor: colors.yellow,
          },
        ]}
      >
        <Icon name={icon} color={colors.teal} size={25} />
      </View>
      <Text style={styles.tileLabel}>{label}</Text>
    </Pressable>
  );
}

export function StoryHeader({
  title,
  subtitle,
  art,
}: {
  title: string;
  subtitle: string;
  art: ImageSourcePropType;
}) {
  return (
    <View style={styles.hero}>
      <Image
        source={art}
        accessible={false}
        style={styles.heroArt}
        resizeMode="cover"
      />
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="shade" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor={colors.teal} />
              <Stop offset="40%" stopColor={colors.teal} />
              <Stop offset="76%" stopColor={colors.jade} stopOpacity={0.18} />
              <Stop offset="100%" stopColor={colors.jade} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#shade)" />
        </Svg>
      </View>
      <View style={styles.heroCopy}>
        <Text style={styles.heroSub}>{subtitle}</Text>
        <Text accessibilityRole="header" style={styles.heroTitle}>
          {title}
        </Text>
      </View>
    </View>
  );
}

export const styles = StyleSheet.create({
  section: { justifyContent: "space-between", minHeight: 32 },
  textAction: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    paddingLeft: 4,
  },
  link: { fontSize: 13, fontWeight: "800", color: colors.teal },
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: 17 },
  tile: { width: "25%", alignItems: "center", gap: 6, paddingHorizontal: 2 },
  tileIcon: {
    width: 52,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
  },
  tileLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  hero: {
    minHeight: 164,
    overflow: "hidden",
    borderRadius: 22,
    backgroundColor: colors.teal,
    justifyContent: "center",
  },
  heroArt: { position: "absolute", width: "69%", right: 0, height: "100%" },
  heroCopy: { width: "68%", padding: 19, gap: 9 },
  heroSub: { color: "#E5F1E8", fontSize: 12, fontWeight: "700" },
  heroTitle: {
    color: "white",
    fontSize: 29,
    lineHeight: 35,
    fontWeight: "800",
    letterSpacing: -1,
  },
});
