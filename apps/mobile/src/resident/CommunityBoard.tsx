import React, { useState } from "react";
import { Image, Pressable, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { useSession, useSnapshot } from "../context";
import type { Item, Page as ResultPage } from "../domain";
import {
  Card,
  Choice,
  Empty,
  Heading,
  Icon,
  Loading,
  Page,
  Row,
  Text,
  colors,
  s,
  useResource,
} from "../ui";
import { Section, TextAction, useResidentNavigation } from "./components";
import { ItemCard } from "../screens/Catalog";

export function ResidentCommunityBoard() {
  const session = useSession();
  const { community } = useSnapshot();
  const nav = useResidentNavigation();
  const focused = useIsFocused();
  const [tab, setTab] = useState("Notices");
  const kind = tab === "Notices" ? "notice" : "post";
  const resource = useResource(
    () =>
      session.request<ResultPage<Item>>(
        `${session.base}/items?kind=${kind}&limit=5`,
      ),
    [session, kind, focused],
  );
  return (
    <Page refresh={resource.reload}>
      <Heading title="Community" subtitle={community?.name} />
      <Image
        source={require("../../assets/images/resident/garden.jpg")}
        accessibilityLabel="Leafy apartment courtyard"
        style={{ height: 174, width: "100%", borderRadius: 20 }}
      />
      <Row style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <Choice value={tab} onChange={setTab} options={["Notices", "Posts"]} />
        {tab === "Posts" && (
          <TextAction
            label="New post"
            onPress={() => nav.push("Editor", { kind: "post" })}
          />
        )}
      </Row>
      {resource.loading || resource.error ? (
        <Loading error={resource.error} retry={resource.reload} />
      ) : resource.data?.items.length ? (
        resource.data.items.map((item) =>
          tab === "Posts" ? (
            <ItemCard key={item.id} item={item} />
          ) : (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={`Open ${item.title}`}
              onPress={() => nav.navigate("Item", { id: item.id })}
            >
              <Card>
                <Row>
                  <Icon name="bullhorn-outline" color={colors.teal} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.title}>{item.title}</Text>
                    <Text style={s.muted}>
                      {item.author} · {item.category}
                    </Text>
                  </View>
                  <Icon name="chevron-right" />
                </Row>
                <Text numberOfLines={2}>{item.description}</Text>
              </Card>
            </Pressable>
          ),
        )
      ) : (
        <Empty title={`No ${tab.toLowerCase()} yet`} />
      )}
      <Section
        title={tab === "Notices" ? "Notice board" : "Community feed"}
        action={
          <TextAction
            label="See all"
            onPress={() =>
              nav.navigate(tab === "Notices" ? "Notices" : "Posts")
            }
          />
        }
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Resident directory"
        onPress={() => nav.navigate("Directory", { group: "Residents" })}
      >
        <Card>
          <Row>
            <Icon name="account-group-outline" color={colors.teal} />
            <Text style={[s.title, { flex: 1 }]}>Resident directory</Text>
            <Icon name="chevron-right" />
          </Row>
        </Card>
      </Pressable>
    </Page>
  );
}
