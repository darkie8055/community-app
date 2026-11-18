import React, { useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, colors, Icon, Row, Text } from "../ui";
import { courtyard, gatehouse, neighbourhood } from "./components";

const slides = [
  {
    image: neighbourhood,
    title: "Welcome to My Home",
    body: "Your visitors, neighbours and everyday essentials, together in one place.",
  },
  {
    image: gatehouse,
    title: "Know who’s at the gate",
    body: "See who’s waiting, approve a delivery or send a guest pass before friends arrive.",
  },
  {
    image: courtyard,
    title: "Meet your neighbourhood",
    body: "Catch up on society notices, discover local services and find good things from your neighbours.",
  },
];

export function ResidentOnboarding({ onComplete }: { onComplete: () => void }) {
  const [index, setIndex] = useState(0);
  const { height } = useWindowDimensions();
  const slide = slides[index];
  const last = index === slides.length - 1;
  return (
    <SafeAreaView style={o.screen}>
      <ScrollView contentContainerStyle={o.scroll}>
        <View style={o.frame}>
          <Row style={o.toolbar}>
            <Row>
              <View style={o.logo}>
                <Icon
                  name="home-variant-outline"
                  color={colors.yellow}
                  size={24}
                />
              </View>
              <Text style={o.brand}>My Home</Text>
            </Row>
            <Pressable
              accessibilityRole="button"
              onPress={onComplete}
              style={o.skip}
            >
              <Text style={o.skipText}>Skip</Text>
            </Pressable>
          </Row>
          <Image
            source={slide.image}
            accessible={false}
            resizeMode="cover"
            style={[
              o.art,
              { height: Math.min(428, Math.max(185, height * 0.43)) },
            ]}
          />
          <View style={o.copy}>
            <Row
              accessible
              accessibilityLabel={`Step ${index + 1} of ${slides.length}`}
              style={{ gap: 6 }}
            >
              {slides.map((item, i) => (
                <View
                  key={item.title}
                  style={[o.dot, i === index && o.active]}
                />
              ))}
            </Row>
            <Text accessibilityRole="header" style={o.title}>
              {slide.title}
            </Text>
            <Text style={o.body}>{slide.body}</Text>
          </View>
          <View style={o.footer}>
            {index > 0 && (
              <Button
                secondary
                title="Back"
                onPress={() => setIndex(index - 1)}
              />
            )}
            <View style={{ flex: 1 }}>
              <Button
                title={last ? "Enter My Home" : "Continue"}
                onPress={() => (last ? onComplete() : setIndex(index + 1))}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const o = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  scroll: { flexGrow: 1, alignItems: "center" },
  frame: {
    flex: 1,
    width: "100%",
    maxWidth: 520,
    paddingHorizontal: 22,
    paddingBottom: 24,
    gap: 18,
  },
  toolbar: { justifyContent: "space-between", paddingTop: 10 },
  logo: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.teal,
    justifyContent: "center",
    alignItems: "center",
  },
  brand: { fontWeight: "800", fontSize: 20, letterSpacing: -0.7 },
  skip: { paddingHorizontal: 12, minHeight: 44, justifyContent: "center" },
  skipText: { color: colors.teal, fontWeight: "700" },
  art: { width: "100%", borderRadius: 24 },
  copy: { paddingVertical: 5, gap: 14 },
  dot: { width: 7, height: 7, borderRadius: 5, backgroundColor: "#CDD7D0" },
  active: { width: 25, backgroundColor: colors.teal },
  title: {
    fontSize: 35,
    lineHeight: 41,
    letterSpacing: -1.4,
    fontWeight: "800",
  },
  body: { fontSize: 16, lineHeight: 25, color: colors.muted },
  footer: { marginTop: "auto", flexDirection: "row", gap: 12, paddingTop: 8 },
});
