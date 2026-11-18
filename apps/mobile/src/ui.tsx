import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text as NativeText,
  TextInput,
  View,
  type TextProps,
  type TextInputProps,
  type ViewProps,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Svg, { Circle, Rect, G } from "react-native-svg";
import * as ImagePicker from "expo-image-picker";
import { errorText } from "./domain";
import { samplePhotos } from "./resident/samplePhotos";

export const colors = {
  teal: "#104A46",
  jade: "#28665E",
  mint: "#E0EEE5",
  yellow: "#F5C861",
  ink: "#172E2B",
  muted: "#526660",
  canvas: "#F8F6F0",
  line: "#DADFD5",
  peach: "#FFF1CE",
  green: "#44816A",
};
export function showAlert(title: string, message: string) {
  if (Platform.OS === "web") globalThis.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}
export function Text({ style, ...props }: TextProps) {
  return <NativeText {...props} style={[s.text, style]} />;
}
export function Heading({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={{ gap: 7, marginBottom: 7 }}>
      <Text accessibilityRole="header" style={s.heading}>
        {title}
      </Text>
      {subtitle && <Text style={s.muted}>{subtitle}</Text>}
    </View>
  );
}
export function Card({ style, ...props }: ViewProps) {
  return <View {...props} style={[s.card, style]} />;
}
export function Row({ style, ...props }: ViewProps) {
  return <View {...props} style={[s.row, style]} />;
}
export function Icon({
  name,
  color = colors.ink,
  size = 22,
}: {
  name: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  color?: string;
  size?: number;
}) {
  return <MaterialCommunityIcons name={name} color={color} size={size} />;
}
export function Button({
  title,
  onPress,
  secondary,
  disabled,
  danger,
}: {
  title: string;
  onPress: () => unknown | Promise<unknown>;
  secondary?: boolean;
  disabled?: boolean;
  danger?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || busy }}
      disabled={disabled || busy}
      onPress={async () => {
        if (locked.current) return;
        locked.current = true;
        setBusy(true);
        try {
          await onPress();
        } catch (e) {
          showAlert("Please try again", errorText(e));
        } finally {
          locked.current = false;
          setBusy(false);
        }
      }}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        danger && { backgroundColor: "#FFEEEE" },
        (disabled || busy || pressed) && { opacity: 0.55 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={secondary ? colors.teal : "white"} />
      ) : (
        <Text
          style={[
            s.buttonText,
            { color: secondary ? colors.teal : "white" },
            danger && { color: "#933E38" },
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}
export function Field({
  label,
  style,
  ...props
}: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 7 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        {...props}
        style={[
          s.input,
          props.multiline && { minHeight: 100, textAlignVertical: "top" },
          style,
        ]}
      />
    </View>
  );
}
export function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState("");
  return (
    <View style={{ gap: 7 }}>
      <Text style={s.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        style={s.input}
        onPress={() => {
          setSearch("");
          setOpen(true);
        }}
      >
        <Row style={{ justifyContent: "space-between" }}>
          <Text>
            {options.find((o) => o.value === value)?.label ??
              "Select an option"}
          </Text>
          <Icon name="chevron-down" />
        </Row>
      </Pressable>
      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={() => setOpen(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            backgroundColor: "#00000066",
            padding: 24,
          }}
        >
          <Card style={{ maxHeight: "85%" }}>
            <Heading title={label} />
            <Field
              label={`Search ${label.toLowerCase()}`}
              value={search}
              onChangeText={setSearch}
            />
            <FlatList
              keyboardShouldPersistTaps="handled"
              data={options.filter((o) =>
                o.label.toLowerCase().includes(search.toLowerCase()),
              )}
              keyExtractor={(o) => o.value}
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  style={{
                    paddingVertical: 15,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.line,
                  }}
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                >
                  <Text>
                    {item.label}
                    {item.value === value ? " ✓" : ""}
                  </Text>
                </Pressable>
              )}
              ListEmptyComponent={<Text>No matches</Text>}
            />
            <Button secondary title="Close" onPress={() => setOpen(false)} />
          </Card>
        </View>
      </Modal>
    </View>
  );
}
export function DateField({
  label,
  value,
  onChange,
  maxDays = 730,
}: {
  label: string;
  value: string;
  onChange: (date: string) => void;
  maxDays?: number;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(new Date());
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maximum = new Date(today);
  maximum.setDate(maximum.getDate() + maxDays);
  const selected = value ? new Date(`${value}T12:00:00`) : today;
  if (Platform.OS === "web")
    return (
      <Field
        label={`${label} (YYYY-MM-DD)`}
        value={value}
        onChangeText={onChange}
        placeholder="YYYY-MM-DD"
      />
    );
  const picker = (
    <DateTimePicker
      value={
        Platform.OS === "ios"
          ? draft
          : Number.isNaN(selected.getTime())
            ? today
            : selected
      }
      minimumDate={today}
      maximumDate={maximum}
      mode="date"
      display={Platform.OS === "ios" ? "spinner" : "default"}
      onChange={(event, date) => {
        if (Platform.OS === "android") setOpen(false);
        if (event.type === "set" && date && Platform.OS === "ios")
          setDraft(date);
        else if (event.type === "set" && date)
          onChange(
            `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
          );
      }}
    />
  );
  return (
    <View style={{ gap: 7 }}>
      <Text style={s.label}>{label}</Text>
      <Button
        secondary
        title={value ? selected.toLocaleDateString("en-IN") : "Select a date"}
        onPress={() => {
          setDraft(Number.isNaN(selected.getTime()) ? today : selected);
          setOpen(true);
        }}
      />
      {open &&
        (Platform.OS === "ios" ? (
          <Modal
            transparent
            animationType="slide"
            onRequestClose={() => setOpen(false)}
          >
            <View
              style={{
                flex: 1,
                justifyContent: "flex-end",
                backgroundColor: "#00000066",
                padding: 24,
              }}
            >
              <Card>
                {picker}
                <Button
                  title="Done"
                  onPress={() => {
                    onChange(
                      `${draft.getFullYear()}-${String(draft.getMonth() + 1).padStart(2, "0")}-${String(draft.getDate()).padStart(2, "0")}`,
                    );
                    setOpen(false);
                  }}
                />
                <Button
                  secondary
                  title="Cancel"
                  onPress={() => setOpen(false)}
                />
              </Card>
            </View>
          </Modal>
        ) : (
          picker
        ))}
    </View>
  );
}
export function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label?: string;
  value: string;
  options: (string | { value: string; label: string })[];
  onChange: (value: string) => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      {label && <Text style={s.label}>{label}</Text>}
      <Row style={{ flexWrap: "wrap" }}>
        {options.map((o) => {
          const v = typeof o === "string" ? o : o.value,
            title = typeof o === "string" ? o : o.label;
          return (
            <Pressable
              key={v}
              accessibilityRole="button"
              accessibilityState={{ selected: value === v }}
              onPress={() => onChange(v)}
              style={[
                s.chip,
                value === v && {
                  backgroundColor: colors.peach,
                  borderColor: colors.teal,
                },
              ]}
            >
              <Text style={{ fontSize: 12, textTransform: "capitalize" }}>
                {title || "All"}
              </Text>
            </Pressable>
          );
        })}
      </Row>
    </View>
  );
}
export function Page({
  children,
  refresh,
}: {
  children: React.ReactNode;
  refresh?: () => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.page}
        refreshControl={
          refresh ? (
            <RefreshControl
              refreshing={busy}
              onRefresh={async () => {
                setBusy(true);
                try {
                  await refresh();
                } catch (e) {
                  showAlert("Unable to refresh", errorText(e));
                } finally {
                  setBusy(false);
                }
              }}
            />
          ) : undefined
        }
      >
        <View style={s.content}>{children}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
export function Empty({
  title = "Nothing here yet",
  message,
}: {
  title?: string;
  message?: string;
}) {
  return (
    <Card style={{ alignItems: "center", paddingVertical: 28 }}>
      <Icon name="home-heart" size={36} color={colors.muted} />
      <Text style={s.title}>{title}</Text>
      {message && (
        <Text style={[s.muted, { textAlign: "center" }]}>{message}</Text>
      )}
    </Card>
  );
}
export function Loading({
  error,
  retry,
}: {
  error?: string | null;
  retry?: () => unknown;
}) {
  return error ? (
    <Card>
      <Text style={{ color: "#BC4A48" }}>{error}</Text>
      {retry && <Button title="Retry" onPress={retry} />}
    </Card>
  ) : (
    <ActivityIndicator style={{ padding: 24 }} color={colors.teal} />
  );
}
export function Photo({
  uri,
  height = 180,
  label = "No photo added",
}: {
  uri?: string;
  height?: number;
  label?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  return uri && !failed ? (
    <Image
      source={samplePhotos[uri] ?? { uri }}
      style={{ height, width: "100%", borderRadius: 18 }}
      onError={() => setFailed(true)}
    />
  ) : (
    <View
      style={{
        height,
        backgroundColor: "#F1EFE9",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 18,
        gap: 10,
      }}
    >
      <Icon name="image-outline" size={32} color={colors.muted} />
      <Text style={s.muted}>{label}</Text>
    </View>
  );
}
export type PhotoAsset = { uri: string; mimeType: string };
export async function pickPhoto(
  camera = false,
): Promise<PhotoAsset | undefined> {
  const permission = camera
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted)
    throw new Error("Allow photo access in device settings to add a photo.");
  const result = await (
    camera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync
  )({ mediaTypes: ["images"], quality: 0.75, allowsEditing: true });
  if (result.canceled) return;
  const asset = result.assets[0];
  if (asset.fileSize && asset.fileSize > 2 * 1024 * 1024)
    throw new Error("Choose a photo smaller than 2 MB.");
  return { uri: asset.uri, mimeType: asset.mimeType || "image/jpeg" };
}
export const confirm = (title: string, message: string) =>
  Platform.OS === "web"
    ? Promise.resolve(globalThis.confirm(`${title}\n\n${message}`))
    : new Promise<boolean>((resolve) =>
        Alert.alert(
          title,
          message,
          [
            { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
            { text: "Continue", onPress: () => resolve(true) },
          ],
          { cancelable: true, onDismiss: () => resolve(false) },
        ),
      );
export function useResource<T>(
  load: () => Promise<T>,
  deps: React.DependencyList,
) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const version = useRef(0);
  const reload = async () => {
    const v = ++version.current;
    setLoading(true);
    setError(null);
    try {
      const next = await load();
      if (v === version.current) setData(next);
    } catch (e) {
      if (v === version.current) setError(errorText(e));
    } finally {
      if (v === version.current) setLoading(false);
    }
  };
  useEffect(() => {
    setData(undefined);
    void reload();
    return () => {
      version.current++;
    };
  }, deps);
  return { data, error, loading, reload };
}
export function useDebounced(value: string, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
export function NeighbourhoodArt() {
  return (
    <Svg viewBox="0 0 320 210" width="100%" height={180}>
      <Circle cx={204} cy={91} r={84} fill="#F5DDCA" />
      <Circle cx={91} cy={45} r={16} fill="#F2C7A6" />
      <Rect x={25} y={184} width={290} height={8} rx={4} fill="#E5C8B4" />
      <Rect x={76} y={67} width={80} height={118} rx={3} fill="#F8F4ED" />
      <Rect x={76} y={67} width={18} height={118} fill="#E5D8C9" />
      <Rect x={70} y={62} width={92} height={7} rx={2} fill="#798E85" />
      <Rect x={174} y={41} width={94} height={144} rx={3} fill="#F9F6EF" />
      <Rect x={174} y={41} width={21} height={144} fill="#E9DDCE" />
      <Rect x={168} y={35} width={106} height={8} rx={2} fill="#7D9588" />
      {[0, 1, 2, 3].map((row) => (
        <G key={row}>
          {[0, 1].map((col) => (
            <Rect
              key={col}
              x={105 + col * 25}
              y={83 + row * 23}
              width={13}
              height={14}
              rx={1}
              fill="#B4C4BD"
            />
          ))}
          {[0, 1, 2].map((col) => (
            <Rect
              key={`b${col}`}
              x={203 + col * 19}
              y={58 + row * 25}
              width={11}
              height={15}
              rx={1}
              fill="#A8BAB0"
            />
          ))}
        </G>
      ))}
      <Rect x={116} y={159} width={16} height={26} rx={1} fill="#718D80" />
      <Rect x={214} y={160} width={20} height={25} rx={1} fill="#718D80" />
      <Rect x={144} y={129} width={49} height={56} rx={2} fill="#DBAF90" />
      <Rect x={140} y={124} width={57} height={7} rx={2} fill="#668675" />
      <Rect x={156} y={144} width={23} height={41} rx={11} fill="#F5E7D4" />
      {[
        [47, 142, 1],
        [290, 148, 0.85],
        [21, 164, 0.6],
      ].map(([x, y, z]) => (
        <G key={x}>
          <Rect
            x={x - 2}
            y={y}
            width={4}
            height={185 - y}
            rx={1}
            fill="#897D65"
          />
          <Circle cx={x} cy={y - 10 * z} r={22 * z} fill="#8CA38A" />
          <Circle cx={x - 5 * z} cy={y - 17 * z} r={16 * z} fill="#9FB39A" />
        </G>
      ))}
      <Rect x={67} y={176} width={30} height={10} rx={6} fill="#8DAB8C" />
      <Rect x={238} y={178} width={31} height={8} rx={6} fill="#8DAB8C" />
      <Circle cx={140} cy={166} r={4} fill="#966C56" />
      <Rect x={137} y={170} width={6} height={11} rx={3} fill="#E78061" />
      <Rect x={137} y={179} width={2} height={7} fill="#56685D" />
      <Rect x={141} y={179} width={2} height={7} fill="#56685D" />
    </Svg>
  );
}
export const s = StyleSheet.create({
  text: {
    fontFamily: "Manrope",
    fontSize: 14,
    lineHeight: 22,
    color: colors.ink,
  },
  muted: { color: colors.muted, fontSize: 12, lineHeight: 20 },
  heading: {
    fontSize: 27,
    lineHeight: 36,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  title: { fontSize: 17, fontWeight: "800" },
  label: { fontSize: 12, fontWeight: "700" },
  page: { padding: 18, paddingBottom: 36, flexGrow: 1, alignItems: "center" },
  content: { width: "100%", maxWidth: 800, gap: 18 },
  card: {
    padding: 16,
    backgroundColor: "white",
    borderRadius: 18,
    gap: 12,
    borderColor: colors.line,
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  button: {
    minHeight: 48,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: colors.teal,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { fontWeight: "800", fontSize: 13, textAlign: "center" },
  secondary: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.line,
  },
  input: {
    backgroundColor: "#FAFBFC",
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    borderRadius: 12,
    fontFamily: "Manrope",
    color: colors.ink,
    fontSize: 14,
  },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "white",
  },
});
