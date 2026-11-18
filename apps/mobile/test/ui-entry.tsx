// Isolated browser regression entry. Never imported by index.js or a native build.
import React, { useEffect, useState } from "react";
import { registerRootComponent } from "expo";
import { useFonts } from "expo-font";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { CommunityNavigator } from "../App";
import { Session } from "../src/api";
import { SessionContext } from "../src/context";
import { type Visitor, type Item, type Role } from "../src/domain";
import { LoginScreen } from "../src/screens/Auth";

const role: Role =
  new URLSearchParams(location.search).get("role") === "guard"
    ? "guard"
    : "resident";
const community = "11111111-1111-4111-8111-111111111111";
const visits: Visitor[] = [
  {
    id: "22222222-2222-4222-8222-222222222222",
    community_id: community,
    unit_id: "unit-a",
    unit: "A-101",
    name: "Test Guest",
    phone: "9876543210",
    type: "guest",
    status: "pending",
    people: 1,
    created_at: new Date().toISOString(),
  },
];
const items: Item[] = (
  ["property", "listing", "service", "post", "notice"] as const
).map((kind, i) => ({
  id: `item-${i}`,
  kind,
  title: `Test ${kind}`,
  description: "An isolated record for checking the migrated interface.",
  category: kind === "property" ? "Rent" : "Community",
  price: kind === "property" ? 18000 : 500,
  author: "Test Neighbour",
  author_id: "neighbour",
  community: "Test Society",
  status: "published",
  saved: false,
  comments: [],
}));
let pass: object | null = null;
const transport: typeof fetch = async (input, init) => {
  const url = new URL(String(input));
  const p = url.pathname;
  const method = init?.method ?? "GET";
  const body = init?.body ? JSON.parse(String(init.body)) : {};
  let data: unknown = {};
  const grant = {
    id: "membership",
    community_id: community,
    unit_id: "unit-a",
    unit: "A-101",
    role: role === "guard" ? "guard" : "owner",
    status: "approved",
  };
  if (p === "/v1/auth/firebase")
    data = {
      access_token: "test-token",
      user: { sub: "test-user", name: "Test Resident", phone: "9876543210" },
    };
  else if (p === "/v1/communities" || p === "/v1/onboarding/communities")
    data = [{ id: community, name: "Test Society" }];
  else if (p.endsWith("memberships")) data = [grant];
  else if (p.endsWith("/structure"))
    data = { units: [{ id: "unit-a", label: "A-101" }] };
  else if (p.endsWith("/notifications"))
    data = [
      {
        id: "notice",
        title: "Visitor waiting",
        body: "Test Guest is at the gate.",
        entry_id: visits[0].id,
        created_at: new Date().toISOString(),
      },
    ];
  else if (p.endsWith("/directory"))
    data = {
      people: [
        { name: "Test Resident", role: "owner", unit: "A-101" },
        { name: "Test Guard", role: "guard", phone: "9876543210" },
      ],
      stats: { homes: 40, blocks: 2, residents: 85 },
    };
  else if (p.endsWith("/visitor-entries")) {
    if (method === "POST") {
      const v = {
        ...body,
        id: "33333333-3333-4333-8333-333333333333",
        community_id: community,
        unit: "A-101",
        created_at: new Date().toISOString(),
        status: body.preapproved ? "approved" : "pending",
      };
      visits.unshift(v);
      data = v;
    } else
      data = {
        items: visits.filter(
          (v) =>
            (!url.searchParams.get("search") ||
              v.name
                .toLowerCase()
                .includes(url.searchParams.get("search")!.toLowerCase())) &&
            (!url.searchParams.get("status") ||
              v.status === url.searchParams.get("status")),
        ),
        next_cursor: null,
      };
  } else if (p.includes("/visitor-entries/")) {
    const parts = p.split("/");
    const v = visits.find((v) => v.id === parts[5])!;
    if (p.endsWith("/decision")) {
      v.status = body.decision;
      v.approved_at = new Date().toISOString();
    } else if (p.endsWith("/check-in")) {
      v.status = "inside";
      v.entered_at = new Date().toISOString();
    } else if (p.endsWith("/check-out")) {
      v.status = "exited";
      v.exited_at = new Date().toISOString();
    }
    if (p.endsWith("/pass")) {
      if (method === "POST")
        pass = {
          entry_id: v.id,
          community_id: community,
          code: "ABCD2345EFGH",
          expires_at: new Date(Date.now() + 3600000).toISOString(),
        };
      if (method === "DELETE") pass = null;
      data = pass;
    } else data = v;
  } else if (p.endsWith("/visitor-passes/verify")) {
    data = { ...visits[0], status: "approved" };
  } else if (p.endsWith("/visitor-passes/check-in")) {
    visits[0].status = "inside";
    data = visits[0];
  } else if (p.endsWith("/items")) {
    data = {
      items: items.filter((i) => i.kind === url.searchParams.get("kind")),
      next_cursor: null,
    };
  } else if (p.includes("/items/")) {
    const id = p.split("/")[5];
    const item = items.find((i) => i.id === id)!;
    if (p.endsWith("/bookmark")) item.saved = !item.saved;
    if (p.endsWith("/comments"))
      item.comments!.push({
        id: "c1",
        author: "Test Resident",
        body: body.message,
      });
    data = item;
  } else if (p.endsWith("/service-requests") || p.endsWith("/inquiries"))
    data = [];
  return new Response(JSON.stringify(data), { status: 200 });
};
const session = new Session(
  "https://test.invalid",
  role,
  async () => "test-id-token",
  transport,
);
function Fixture() {
  const [ready, setReady] = useState(false);
  const [fonts] = useFonts({ Manrope: require("../assets/fonts/Manrope.ttf") });
  useEffect(() => {
    void session.signIn("Test Resident").then(() => setReady(true));
  }, []);
  return (
    <SafeAreaProvider>
      <SessionContext.Provider value={session}>
        {fonts &&
          ready &&
          (location.search.includes("login") ? (
            <LoginScreen />
          ) : (
            <CommunityNavigator
              notifications={async () => {}}
              logout={async () => session.clear()}
            />
          ))}
      </SessionContext.Provider>
    </SafeAreaProvider>
  );
}
registerRootComponent(Fixture);
