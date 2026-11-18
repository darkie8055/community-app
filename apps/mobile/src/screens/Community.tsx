import React from "react";
import { Linking, Pressable, View } from "react-native";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { type Routes, useSession, useSnapshot } from "../context";
import {
  type Directory,
  type Item,
  type Page as ResultPage,
  dateText,
} from "../domain";
import {
  Button,
  Card,
  Empty,
  Heading,
  Icon,
  Loading,
  NeighbourhoodArt,
  Page,
  Row,
  Text,
  colors,
  s,
  useResource,
} from "../ui";
import { VisitCard } from "./Visitors";
import { ItemCard } from "./Catalog";

export function QuickActions() {
  const session = useSession();
  const nav = useNavigation<NativeStackNavigationProp<Routes>>();
  const actions: {
    label: string;
    icon: React.ComponentProps<typeof Icon>["name"];
    route:
      | "VisitorForm"
      | "Visitors"
      | "Notices"
      | "Community"
      | "Profile"
      | "Notifications"
      | "Activity"
      | "Homes"
      | "Marketplace"
      | "Stores";
  }[] = [
    {
      label: session.role === "resident" ? "Pre-approve" : "New visitor",
      icon: "account-plus-outline",
      route: "VisitorForm",
    },
    { label: "My visitors", icon: "account-group-outline", route: "Visitors" },
    { label: "Notice board", icon: "clipboard-text-outline", route: "Notices" },
    { label: "Security", icon: "shield-check-outline", route: "Community" },
    { label: "My home", icon: "home-outline", route: "Profile" },
    { label: "Directory", icon: "book-account-outline", route: "Community" },
    { label: "Updates", icon: "bell-outline", route: "Notifications" },
    { label: "My requests", icon: "receipt-text-outline", route: "Activity" },
  ];
  return (
    <Card>
      <Text style={s.title}>Quick actions</Text>
      <Row style={{ flexWrap: "wrap", justifyContent: "space-between" }}>
        {actions.map((a, i) => (
          <Pressable
            accessibilityRole="button"
            key={a.label}
            onPress={() => nav.navigate(a.route)}
            style={{
              width: "22%",
              alignItems: "center",
              gap: 7,
              paddingVertical: 9,
            }}
          >
            <View
              style={{
                padding: 13,
                borderRadius: 18,
                backgroundColor: ["#F5E2D8", "#E1EBE4", "#FFF4D4", "#E3E7F0"][
                  i % 4
                ],
              }}
            >
              <Icon name={a.icon} />
            </View>
            <Text style={{ fontSize: 10, textAlign: "center" }}>{a.label}</Text>
          </Pressable>
        ))}
      </Row>
    </Card>
  );
}
function Posts() {
  const session = useSession();
  const nav = useNavigation<NativeStackNavigationProp<Routes>>();
  const focused = useIsFocused();
  const posts = useResource(
    () =>
      session.request<ResultPage<Item>>(
        `${session.base}/items?kind=post&limit=5`,
      ),
    [focused],
  );
  return (
    <>
      <Row style={{ justifyContent: "space-between" }}>
        <Text style={s.title}>Community Posts</Text>
        {session.role === "resident" && (
          <Button
            secondary
            title="New post"
            onPress={() => nav.navigate("Editor", { kind: "post" })}
          />
        )}
      </Row>
      {posts.loading ? (
        <Loading />
      ) : posts.error ? (
        <Loading error={posts.error} retry={posts.reload} />
      ) : posts.data?.items.length ? (
        posts.data.items.map((i) => <ItemCard key={i.id} item={i} />)
      ) : (
        <Empty message="Start a conversation with your neighbours." />
      )}
    </>
  );
}
export function GuardDashboard() {
  const session = useSession();
  const snapshot = useSnapshot();
  const nav = useNavigation<NativeStackNavigationProp<Routes>>();
  const atGate = snapshot.entries.filter((visit) =>
    ["pending", "approved"].includes(visit.status),
  );
  const inside = snapshot.entries.filter((visit) => visit.status === "inside");
  const today = new Date().toDateString();
  const stats = [
    [
      "Visitors today",
      snapshot.entries.filter(
        (visit) => new Date(visit.created_at).toDateString() === today,
      ).length,
    ],
    ["Inside now", inside.length],
    ["At the gate", atGate.length],
  ];
  return (
    <Page refresh={() => session.refresh()}>
      <Heading
        title="A safe community starts here."
        subtitle={`Welcome, ${snapshot.user?.name ?? ""}. You’re on duty at Main Gate.`}
      />
      <Card style={{ backgroundColor: colors.teal }}>
        <Text style={{ color: "white", fontSize: 10, letterSpacing: 1.8 }}>
          MAIN GATE
        </Text>
        <Text style={[s.heading, { color: "white" }]}>
          Every welcome,{"\n"}made a little safer.
        </Text>
        <View style={{ backgroundColor: "white", borderRadius: 16 }}>
          <Button
            secondary
            title="New visitor"
            onPress={() => nav.navigate("VisitorForm")}
          />
        </View>
      </Card>
      <Button
        title="Scan QR / verify visitor code"
        onPress={() => nav.navigate("Verify")}
      />
      <Row>
        {stats.map(([label, value]) => (
          <Card key={label} style={{ flex: 1, padding: 12 }}>
            <Text style={s.heading}>{String(value).padStart(2, "0")}</Text>
            <Text style={{ fontSize: 10 }}>{label}</Text>
          </Card>
        ))}
      </Row>
      <Heading title="At the gate" subtitle="Register. Verify. Welcome." />
      {atGate.length ? (
        atGate.map((visit) => (
          <VisitCard key={visit.id} visit={visit} actions />
        ))
      ) : (
        <Empty
          title="The gate is clear"
          message="New requests will appear here as you register visitors."
        />
      )}
      <Heading
        title="Currently inside"
        subtitle="A little peace of mind, in real time."
      />
      {inside.map((visit) => (
        <VisitCard key={visit.id} visit={visit} actions />
      ))}
      <Button
        secondary
        title="View all visitors"
        onPress={() => nav.navigate("Visitors")}
      />
    </Page>
  );
}
export function CommunityScreen() {
  const session = useSession();
  const snapshot = useSnapshot();
  const nav = useNavigation<NativeStackNavigationProp<Routes>>();
  const focused = useIsFocused();
  const resource = useResource(async () => {
    const [directory, notices] = await Promise.all([
      session.request<Directory>(`${session.base}/directory`),
      session.request<ResultPage<Item>>(
        `${session.base}/items?kind=notice&limit=5`,
      ),
    ]);
    return { directory, notices };
  }, [focused]);
  return (
    <Page refresh={resource.reload}>
      <Card style={{ backgroundColor: colors.peach }}>
        <Text style={s.muted}>A LITTLE MORE CONNECTED</Text>
        <Heading
          title={snapshot.community?.name ?? "Your community"}
          subtitle="Your neighbours. Your everyday."
        />
        <NeighbourhoodArt />
      </Card>
      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <Loading error={resource.error} retry={resource.reload} />
      ) : (
        <>
          <Row>
            {Object.entries(resource.data?.directory.stats ?? {}).map(
              ([label, value]) => (
                <Card key={label} style={{ flex: 1, padding: 12 }}>
                  <Text style={s.muted}>{label}</Text>
                  <Text style={s.heading}>{value}</Text>
                </Card>
              ),
            )}
          </Row>
          <QuickActions />
          <Row style={{ flexWrap: "wrap" }}>
            <Button
              secondary
              title="Homes"
              onPress={() => nav.navigate("Homes")}
            />
            <Button
              secondary
              title="Buy & Sell"
              onPress={() => nav.navigate("Marketplace")}
            />
            <Button
              secondary
              title="Services"
              onPress={() => nav.navigate("Stores")}
            />
            <Button
              secondary
              title="Membership"
              onPress={() => nav.navigate("Membership")}
            />
          </Row>
          <Heading title="Notice Board" />
          {resource.data?.notices.items.map((i) => (
            <ItemCard key={i.id} item={i} />
          ))}
          <Button
            secondary
            title="View all notices"
            onPress={() => nav.navigate("Notices")}
          />
          <Posts />
          <Heading
            title="Connect with Neighbours"
            subtitle="Residents who call your society home"
          />
          {resource.data?.directory.people
            .filter((p) => !["guard", "admin"].includes(p.role))
            .map((p, i) => (
              <Card key={`${p.name}-${i}`}>
                <Row>
                  <Icon name="account-circle-outline" size={35} />
                  <View>
                    <Text style={s.title}>{p.name}</Text>
                    <Text style={s.muted}>
                      {p.unit} · {p.role}
                    </Text>
                  </View>
                </Row>
              </Card>
            ))}
          <Heading title="Security & Society Directory" />
          {resource.data?.directory.people
            .filter((p) => ["guard", "admin"].includes(p.role))
            .map((p, i) => (
              <Card key={`${p.name}-${i}`}>
                <Text style={s.title}>{p.name}</Text>
                <Text>
                  {p.role}
                  {p.phone ? ` · +91 ${p.phone}` : ""}
                </Text>
                {p.phone && (
                  <Button
                    secondary
                    title={`Call ${p.name}`}
                    onPress={() =>
                      Linking.openURL(`tel:+91${p.phone!.replace(/\D/g, "")}`)
                    }
                  />
                )}
              </Card>
            ))}
        </>
      )}
    </Page>
  );
}
export function NotificationsScreen() {
  const session = useSession();
  const snapshot = useSnapshot();
  const nav = useNavigation<NativeStackNavigationProp<Routes>>();
  return (
    <Page refresh={() => session.refresh()}>
      <Heading title="Your updates" subtitle="A little more in the loop." />
      <Button
        secondary
        title="Mark all as read"
        onPress={async () => {
          await session.request("/v1/notifications/read", "POST");
          await session.refresh();
        }}
      />
      {snapshot.notifications.length ? (
        snapshot.notifications.map((n) => (
          <Card
            key={n.id}
            style={
              !n.read_at
                ? { borderLeftWidth: 4, borderLeftColor: colors.yellow }
                : undefined
            }
          >
            <Text style={s.title}>{n.title}</Text>
            <Text>{n.body}</Text>
            <Text style={s.muted}>{dateText(n.created_at)}</Text>
            {n.entry_id && (
              <Button
                secondary
                title="View visitor"
                onPress={() => nav.navigate("Visitor", { id: n.entry_id! })}
              />
            )}
          </Card>
        ))
      ) : (
        <Empty
          title="You’re all caught up"
          message="Your community updates will appear here."
        />
      )}
    </Page>
  );
}
