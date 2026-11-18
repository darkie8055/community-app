import React, { createContext, useContext, useState } from "react";
import { View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { type Routes, useSession } from "../context";
import {
  Button,
  Card,
  Choice,
  DateField,
  Empty,
  Field,
  Heading,
  Icon,
  Page,
  Row,
  Text,
  colors,
  s,
} from "../ui";
import {
  householdTools,
  initialRecords,
  type HouseholdRecord,
  type HouseholdRecords,
  type HouseholdTool,
} from "./householdData";

type HouseholdState = {
  records: HouseholdRecords;
  add: (tool: HouseholdTool, entry: HouseholdRecord) => void;
};
const HouseholdContext = createContext<HouseholdState | null>(null);

export function HouseholdProvider({ children }: { children: React.ReactNode }) {
  const [records, setRecords] = useState(initialRecords);
  const add = (tool: HouseholdTool, entry: HouseholdRecord) =>
    setRecords((previous) => ({
      ...previous,
      [tool]: [entry, ...previous[tool]],
    }));
  return (
    <HouseholdContext.Provider value={{ records, add }}>
      {children}
    </HouseholdContext.Provider>
  );
}

function SocietyBills() {
  const session = useSession();
  const [expanded, setExpanded] = useState(false);
  return (
    <Page>
      <Heading
        title="Society bills"
        subtitle={`Sample statement · ${session.ownUnits[0]?.label ?? "My flat"}`}
      />
      <Card>
        <Icon name="receipt-text-outline" color={colors.teal} size={32} />
        <Text style={s.muted}>Monthly maintenance</Text>
        <Text style={s.heading}>₹2,400</Text>
        <Button
          secondary
          title={expanded ? "Hide breakdown" : "View breakdown"}
          onPress={() => setExpanded(!expanded)}
        />
        {expanded && (
          <View style={{ gap: 8 }}>
            <Text>Society upkeep · ₹1,800</Text>
            <Text>Common utilities · ₹450</Text>
            <Text>Reserve fund · ₹150</Text>
          </View>
        )}
      </Card>
    </Page>
  );
}

function Collection({ tool }: { tool: Exclude<HouseholdTool, "bills"> }) {
  const state = useContext(HouseholdContext);
  const [text, setText] = useState("");
  const [facility, setFacility] = useState("Clubhouse");
  const [slot, setSlot] = useState("9–10 am");
  const [day, setDay] = useState("");
  const [error, setError] = useState("");
  if (!state) throw new Error("Household screens require HouseholdProvider");
  const config = householdTools[tool];
  const entries = state.records[tool];
  const dated = tool === "amenities" || tool === "planner";
  const save = () => {
    const title = tool === "amenities" ? facility : text.trim();
    if (title.length < 2)
      return setError("Please enter at least two characters.");
    if (dated) {
      const chosen = new Date(day + "T00:00:00");
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
        !Number.isFinite(chosen.getTime()) ||
        chosen < today ||
        chosen.getDate() !== Number(day.slice(-2))
      )
        return setError("Choose today or a future date.");
    }
    const detail =
      tool === "amenities"
        ? `${day} · ${slot}`
        : tool === "planner"
          ? day
          : tool === "helpdesk"
            ? "Open"
            : "Added to your home";
    if (
      entries.some(
        (entry) =>
          entry.title.toLowerCase() === title.toLowerCase() &&
          entry.detail === detail,
      )
    )
      return setError(
        tool === "amenities"
          ? "You already reserved this slot."
          : "This entry is already on your list.",
      );
    state.add(tool, { title, detail });
    setText("");
    setError("");
  };
  return (
    <Page>
      <Heading title={config.title} subtitle="Local preview · This session" />
      <Card>
        {tool === "amenities" ? (
          <Choice
            label="Facility"
            value={facility}
            onChange={setFacility}
            options={["Clubhouse", "Badminton court", "Pool"]}
          />
        ) : (
          <Field
            label={config.label}
            value={text}
            onChangeText={setText}
            multiline={tool === "helpdesk"}
            maxLength={180}
          />
        )}
        {dated && <DateField label="Date" value={day} onChange={setDay} />}
        {tool === "amenities" && (
          <Choice
            label="Time slot"
            value={slot}
            onChange={setSlot}
            options={["9–10 am", "3–4 pm", "5–6 pm"]}
          />
        )}
        {!!error && (
          <Text accessibilityRole="alert" style={{ color: "#953F31" }}>
            {error}
          </Text>
        )}
        <Button title={config.action} onPress={save} />
      </Card>
      {entries.length === 0 ? (
        <Empty title="No entries yet" message={config.empty} />
      ) : (
        entries.map((entry) => (
          <Card key={entry.title + entry.detail}>
            <Row>
              <Icon name={config.icon} color={colors.teal} />
              <View style={{ flex: 1 }}>
                <Text style={s.title}>{entry.title}</Text>
                <Text style={s.muted}>{entry.detail}</Text>
              </View>
            </Row>
          </Card>
        ))
      )}
    </Page>
  );
}

export function HouseholdScreen({
  route,
}: NativeStackScreenProps<Routes, "Household">) {
  const { tool } = route.params;
  return tool === "bills" ? (
    <SocietyBills />
  ) : (
    <Collection key={tool} tool={tool} />
  );
}
