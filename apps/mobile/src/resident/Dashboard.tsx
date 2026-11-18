import React from "react";
import { Pressable, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { useSession, useSnapshot } from "../context";
import type { Item, Page as ResultPage } from "../domain";
import {
  Card,
  Empty,
  Icon,
  Loading,
  Page,
  Row,
  Text,
  colors,
  s,
  useResource,
} from "../ui";
import { VisitCard } from "../screens/Visitors";
import {
  ActionTile,
  neighbourhood,
  Section,
  StoryHeader,
  styles,
  TextAction,
  useResidentNavigation,
} from "./components";
import { invite, residents, visitorLog } from "./featureGroups";

export function ResidentDashboard() {
  const session = useSession();
  const snapshot = useSnapshot();
  const nav = useResidentNavigation();
  const focused = useIsFocused();
  const notices = useResource(
    () =>
      session.request<ResultPage<Item>>(
        session.base + "/items?kind=notice&limit=1",
      ),
    [session, focused],
  );
  const pending = snapshot.entries.filter(
    (visitor) => visitor.status === "pending",
  );
  const updates = snapshot.entries
    .filter((visitor) => visitor.status !== "pending")
    .slice(0, 3);
  const latest = notices.data?.items[0];
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return (
    <Page
      refresh={async () => {
        await Promise.all([session.refresh(), notices.reload()]);
      }}
    >
      <StoryHeader
        title={`${greeting},\n${snapshot.user?.name.split(" ")[0] ?? "neighbour"}`}
        subtitle={[snapshot.community?.name, session.ownUnits[0]?.label]
          .filter(Boolean)
          .join("  ·  ")}
        art={neighbourhood}
      />
      <View style={{ gap: 8 }}>
        <Section title="At your gate" />
        {pending.length ? (
          pending.map((visitor) => (
            <VisitCard key={visitor.id} visit={visitor} actions />
          ))
        ) : (
          <Empty
            title="You’re all caught up"
            message="There are no visitors waiting for approval."
          />
        )}
      </View>
      <View style={{ gap: 8 }}>
        <Section title="Quick actions" />
        <View style={styles.grid}>
          {[invite, visitorLog, residents].map((feature) => (
            <ActionTile
              key={feature.label}
              label={feature.label}
              icon={feature.icon}
              onPress={() => feature.open(nav)}
            />
          ))}
          <ActionTile
            label="View More"
            icon="plus"
            accent
            onPress={() => nav.navigate("Features")}
          />
        </View>
      </View>
      <View style={{ gap: 5 }}>
        <Section
          title="Latest notice"
          action={
            <TextAction
              label="See all"
              onPress={() => nav.navigate("Notices")}
            />
          }
        />
        {notices.loading || notices.error ? (
          <Loading error={notices.error} retry={notices.reload} />
        ) : latest ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${latest.title}`}
            onPress={() => nav.navigate("Item", { id: latest.id })}
          >
            <Card>
              <Row>
                <Icon name="bullhorn-outline" color={colors.teal} />
                <View style={{ flex: 1 }}>
                  <Text style={s.title}>{latest.title}</Text>
                  <Text style={s.muted}>{latest.author}</Text>
                </View>
                <Icon name="chevron-right" />
              </Row>
            </Card>
          </Pressable>
        ) : (
          <Empty title="No notices yet" />
        )}
      </View>
      <Section
        title="Entry updates"
        action={
          <TextAction
            label="Visitor log"
            onPress={() => nav.navigate("Visitors")}
          />
        }
      />
      {updates.length ? (
        updates.map((visitor) => <VisitCard key={visitor.id} visit={visitor} />)
      ) : (
        <Empty title="No recent entries" />
      )}
    </Page>
  );
}
