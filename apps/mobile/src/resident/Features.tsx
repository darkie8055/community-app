import React, { useState } from "react";
import { View } from "react-native";
import { useSession } from "../context";
import { Empty, Field, Heading, Page } from "../ui";
import {
  ActionTile,
  Section,
  styles,
  useResidentNavigation,
} from "./components";
import { featureGroups } from "./featureGroups";

export function FeaturesScreen() {
  const session = useSession();
  const nav = useResidentNavigation();
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const visible = featureGroups
    .map((group) => ({
      title: group.title,
      features: group.features.filter(
        (feature) =>
          (session.isDemo || !feature.previewOnly) &&
          (group.title + " " + feature.label).toLowerCase().includes(query),
      ),
    }))
    .filter((group) => group.features.length > 0);
  return (
    <Page>
      <Heading title="All features" />
      <Field
        label="Search features"
        placeholder="Try visitors, amenities or pets"
        value={search}
        onChangeText={setSearch}
        returnKeyType="search"
        clearButtonMode="while-editing"
      />
      {visible.length === 0 && (
        <Empty
          title="No matching features"
          message="Try another feature or category name."
        />
      )}
      {visible.map((group) => (
        <View key={group.title} style={{ gap: 9 }}>
          <Section title={group.title} />
          <View style={styles.grid}>
            {group.features.map((feature) => (
              <ActionTile
                key={feature.label}
                label={feature.label}
                icon={feature.icon}
                onPress={() => feature.open(nav)}
              />
            ))}
          </View>
        </View>
      ))}
    </Page>
  );
}
