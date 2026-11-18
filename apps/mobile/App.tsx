import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Linking,
  Platform,
  Pressable,
  StatusBar,
  View,
} from "react-native";
import Constants from "expo-constants";
import { useFonts } from "expo-font";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import {
  NavigationContainer,
  createNavigationContainerRef,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import {
  createNativeStackNavigator,
  type NativeStackNavigationProp,
} from "@react-navigation/native-stack";
import { Session } from "./src/api";
import { createDemoWorkspace } from "./src/demo";
import {
  type Routes,
  SessionContext,
  useSession,
  useSnapshot,
} from "./src/context";
import { type Role } from "./src/domain";
import {
  enablePush,
  identityToken,
  reportCrash,
  restoreIdentity,
  signOutNative,
  unregisterPush,
} from "./src/native";
import {
  Button,
  Card,
  Heading,
  Icon,
  Page,
  Row,
  Text,
  colors,
  s,
  showAlert,
} from "./src/ui";
import { LoginScreen, MembershipScreen, SetupScreen } from "./src/screens/Auth";
import { ResidentOnboarding } from "./src/resident/Onboarding";
import { ResidentDashboard } from "./src/resident/Dashboard";
import { ResidentCommunityBoard } from "./src/resident/CommunityBoard";
import { FeaturesScreen } from "./src/resident/Features";
import { DirectoryScreen } from "./src/resident/Directory";
import { HouseholdProvider, HouseholdScreen } from "./src/resident/Household";
import { ResidentToolbar } from "./src/resident/Toolbar";
import {
  PassScreen,
  VerifyScreen,
  VisitorFormScreen,
  VisitorScreen,
  VisitorsScreen,
} from "./src/screens/Visitors";
import {
  ActivityScreen,
  CatalogScreen,
  EditorScreen,
  ItemScreen,
} from "./src/screens/Catalog";
import {
  CommunityScreen,
  GuardDashboard,
  NotificationsScreen,
} from "./src/screens/Community";

const Stack = createNativeStackNavigator<Routes>();
const navRef = createNavigationContainerRef<Routes>();
const config = Constants.expoConfig?.extra ?? {};
const platform = config[Platform.OS] ?? {};
const role: Role = config.role === "guard" ? "guard" : "resident";
const session = new Session(platform.apiUrl ?? "", role, identityToken);
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    if (!platform.demo && platform.configured) void reportCrash(error);
  }
  render() {
    return this.state.error ? (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }}>
        <Page>
          <Heading
            title="Something went wrong"
            subtitle="Please try opening your community again."
          />
          <Button
            title="Try again"
            onPress={() => {
              session.clearCommunity();
              this.setState({ error: null });
            }}
          />
        </Page>
      </SafeAreaView>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  const [fonts, error] = useFonts({
    Manrope: require("./assets/fonts/Manrope.ttf"),
  });
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <ErrorBoundary>
        {!fonts && !error ? (
          <ActivityIndicator style={{ flex: 1 }} color={colors.teal} />
        ) : platform.demo ? (
          <DemoApplication />
        ) : (
          <SessionContext.Provider value={session}>
            <Application />
          </SessionContext.Provider>
        )}
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
type DemoControls = {
  switchRole: () => Promise<void>;
  reset: () => Promise<void>;
};

function DemoApplication() {
  const [workspace] = useState(createDemoWorkspace);
  const [selectedSession, setSelectedSession] = useState(() =>
    workspace.session(role),
  );
  const [opening, setOpening] = useState(true);
  const [openError, setOpenError] = useState("");
  const [revision, setRevision] = useState(0);
  const [onboarded, setOnboarded] = useState(false);
  const enter = async (nextRole: Role, reset = false) => {
    setOpening(true);
    setOpenError("");
    try {
      if (reset) {
        workspace.reset();
        setRevision((value) => value + 1);
      }
      const next = workspace.session(nextRole);
      await next.signIn(nextRole === "guard" ? "Ravi Kumar" : "Ananya Sharma");
      setSelectedSession(next);
    } catch (error) {
      setOpenError(
        error instanceof Error ? error.message : "Unable to open the demo.",
      );
    } finally {
      setOpening(false);
    }
  };
  useEffect(() => {
    void enter(role);
  }, []);
  const controls: DemoControls = {
    switchRole: () =>
      enter(selectedSession.role === "resident" ? "guard" : "resident"),
    reset: () => enter(selectedSession.role, true),
  };
  return (
    <SessionContext.Provider value={selectedSession}>
      {opening ? (
        <ActivityIndicator style={{ flex: 1 }} color={colors.teal} />
      ) : openError ? (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }}>
          <Page>
            <Heading title="Let’s reopen the demo" subtitle={openError} />
            <Button title="Reset and try again" onPress={controls.reset} />
          </Page>
        </SafeAreaView>
      ) : selectedSession.role === "resident" && !onboarded ? (
        <ResidentOnboarding onComplete={() => setOnboarded(true)} />
      ) : (
        <DemoContent
          key={`${selectedSession.role}-${revision}`}
          enter={enter}
          controls={controls}
        />
      )}
    </SessionContext.Provider>
  );
}

function DemoContent({
  enter,
  controls,
}: {
  enter: (role: Role) => Promise<void>;
  controls: DemoControls;
}) {
  const demoSession = useSession();
  const snapshot = useSnapshot();
  if (!snapshot.user)
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }}>
        <Page>
          <Icon name="home-heart" size={54} />
          <Heading
            title="You’re home."
            subtitle="Explore a sample community. No sign-in or setup needed."
          />
          <Card>
            <Button
              title="Open resident demo"
              onPress={() => enter("resident")}
            />
            <Button
              secondary
              title="Open guard demo"
              onPress={() => enter("guard")}
            />
            <Text style={s.muted}>
              Demo changes stay on this device and reset when you reload the
              app.
            </Text>
          </Card>
        </Page>
      </SafeAreaView>
    );
  if (!snapshot.community)
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }}>
        <MembershipScreen />
      </SafeAreaView>
    );
  return (
    <CommunityNavigator
      demoControls={controls}
      notifications={async () => {
        showAlert(
          "Demo notifications",
          "Sample updates are available in the notification inbox. Live push notifications can be connected later.",
        );
      }}
      logout={async () => demoSession.clear()}
    />
  );
}

function Application() {
  const snapshot = useSnapshot();
  const [restoring, setRestoring] = useState(Boolean(platform.configured));
  const [restoreError, setRestoreError] = useState(false);
  const pushCleanup = useRef<(() => void) | undefined>(undefined);
  const pendingPass = useRef<string | undefined>(undefined);
  const restore = async () => {
    setRestoring(true);
    setRestoreError(false);
    try {
      const name = await restoreIdentity();
      if (name) await session.signIn(name);
    } catch {
      setRestoreError(true);
    } finally {
      setRestoring(false);
    }
  };
  useEffect(() => {
    if (platform.configured) void restore();
    return () => pushCleanup.current?.();
  }, []);
  useEffect(() => {
    if (!snapshot.community) return;
    const refresh = () => {
      if (AppState.currentState === "active")
        void session.refresh().catch(() => {});
    };
    const timer = setInterval(refresh, 15000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [snapshot.community?.id]);
  useEffect(() => {
    if (!snapshot.user) {
      pushCleanup.current?.();
      pushCleanup.current = undefined;
    }
  }, [snapshot.user]);
  const openPass = (url: string) => {
    if (role !== "guard" || !/^(myhome|mycommunity):\/\/pass\//.test(url)) return;
    pendingPass.current = url;
    if (navRef.isReady() && session.snapshot.community) {
      navRef.navigate("Verify", { code: url });
      pendingPass.current = undefined;
    }
  };
  useEffect(() => {
    void Linking.getInitialURL().then((url) => {
      if (url) openPass(url);
    });
    const sub = Linking.addEventListener("url", (event) => openPass(event.url));
    return () => sub.remove();
  }, []);
  const logout = async () => {
    pushCleanup.current?.();
    pushCleanup.current = undefined;
    await unregisterPush(session);
    await signOutNative();
    session.clear();
  };
  const notifications = async () => {
    pushCleanup.current?.();
    pushCleanup.current = await enablePush(session, (id) => {
      if (navRef.isReady() && session.snapshot.community)
        navRef.navigate("Visitor", { id });
    });
  };
  useEffect(() => {
    if (!snapshot.user || !snapshot.community) return;
    let active = true;
    void enablePush(session, (id) => {
      if (active && navRef.isReady() && session.snapshot.community)
        navRef.navigate("Visitor", { id });
    })
      .then((stop) => {
        if (active) {
          pushCleanup.current?.();
          pushCleanup.current = stop;
        } else stop();
      })
      .catch(() => {});
    return () => {
      active = false;
      pushCleanup.current?.();
      pushCleanup.current = undefined;
    };
  }, [snapshot.user?.sub, snapshot.community?.id]);
  if (!platform.configured || !platform.apiUrl)
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }}>
        <SetupScreen />
      </SafeAreaView>
    );
  if (restoring)
    return <ActivityIndicator style={{ flex: 1 }} color={colors.teal} />;
  if (restoreError)
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }}>
        <Page>
          <Heading
            title="Unable to reconnect"
            subtitle="Check your connection and try again."
          />
          <Button title="Retry" onPress={restore} />
          <Button
            secondary
            title="Sign in again"
            onPress={async () => {
              await signOutNative();
              session.clear();
              setRestoreError(false);
            }}
          />
        </Page>
      </SafeAreaView>
    );
  if (!snapshot.user)
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }}>
        <LoginScreen />
      </SafeAreaView>
    );
  if (!snapshot.community)
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }}>
        <MembershipScreen />
      </SafeAreaView>
    );
  return (
    <CommunityNavigator
      notifications={notifications}
      logout={logout}
      onReady={() => {
        if (pendingPass.current) openPass(pendingPass.current);
      }}
    />
  );
}
const TAB_SCREENS: Record<Role, (keyof Routes)[]> = {
  resident: ["Home", "Homes", "Community", "Marketplace", "Stores"],
  guard: ["Home", "Visitors", "Community", "Notifications", "Profile"],
};

export function CommunityNavigator({
  notifications,
  logout,
  onReady,
  demoControls,
}: {
  notifications: () => Promise<void>;
  logout: () => Promise<void>;
  onReady?: () => void;
  demoControls?: DemoControls;
}) {
  const session = useSession();
  const snapshot = useSnapshot();
  if (!snapshot.community) return null;
  return (
    <HouseholdProvider key={snapshot.community.id}>
      <NavigationContainer
        key={snapshot.community.id}
        ref={navRef}
        onReady={onReady}
        theme={{
          dark: false,
          colors: {
            primary: colors.teal,
            background: colors.canvas,
            card: colors.canvas,
            text: colors.ink,
            border: colors.line,
            notification: colors.yellow,
          },
          fonts: {
            regular: { fontFamily: "Manrope", fontWeight: "400" },
            medium: { fontFamily: "Manrope", fontWeight: "500" },
            bold: { fontFamily: "Manrope", fontWeight: "700" },
            heavy: { fontFamily: "Manrope", fontWeight: "800" },
          },
        }}
      >
        <Stack.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            contentStyle: { backgroundColor: colors.canvas },
            animation: TAB_SCREENS[session.role].includes(route.name)
              ? "none"
              : "slide_from_right",
          })}
          screenLayout={({ children }) => (
            <Shell demoControls={demoControls}>{children}</Shell>
          )}
        >
          <Stack.Screen
            name="Home"
            component={
              session.role === "resident" ? ResidentDashboard : GuardDashboard
            }
          />
          {session.role === "resident" && (
            <>
              <Stack.Screen name="Features" component={FeaturesScreen} />
              <Stack.Screen name="Directory" component={DirectoryScreen} />
              <Stack.Screen name="Posts">
                {() => <CatalogScreen kind="post" />}
              </Stack.Screen>
              {session.isDemo && (
                <Stack.Screen name="Household" component={HouseholdScreen} />
              )}
            </>
          )}
          <Stack.Screen name="Visitors" component={VisitorsScreen} />
          <Stack.Screen name="Visitor" component={VisitorScreen} />
          <Stack.Screen name="VisitorForm" component={VisitorFormScreen} />
          <Stack.Screen name="Pass" component={PassScreen} />
          <Stack.Screen name="Verify" component={VerifyScreen} />
          <Stack.Screen name="Homes">
            {() => <CatalogScreen kind="property" />}
          </Stack.Screen>
          <Stack.Screen name="Marketplace">
            {() => <CatalogScreen kind="listing" />}
          </Stack.Screen>
          <Stack.Screen name="Stores">
            {() => <CatalogScreen kind="service" />}
          </Stack.Screen>
          <Stack.Screen name="Notices">
            {() => <CatalogScreen kind="notice" />}
          </Stack.Screen>
          <Stack.Screen
            name="Community"
            component={
              session.role === "resident"
                ? ResidentCommunityBoard
                : CommunityScreen
            }
          />
          <Stack.Screen name="Item" component={ItemScreen} />
          <Stack.Screen name="Editor" component={EditorScreen} />
          <Stack.Screen name="Activity" component={ActivityScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          <Stack.Screen name="Membership">
            {({ navigation }) => (
              <MembershipScreen onOpen={() => navigation.navigate("Home")} />
            )}
          </Stack.Screen>
          <Stack.Screen name="Profile">
            {({ navigation }) => (
              <Page>
                <Heading
                  title="Your profile"
                  subtitle="A little more at home."
                />
                <Card>
                  <Icon name="account-circle-outline" size={60} />
                  <Text style={s.heading}>{snapshot.user?.name}</Text>
                  <Text>+91 {snapshot.user?.phone}</Text>
                  <Text>{snapshot.community?.name}</Text>
                  {snapshot.memberships.map((m) => (
                    <Text key={m.id}>
                      {m.unit ?? "Society"} · {m.role} · {m.status}
                    </Text>
                  ))}
                </Card>
                <Button
                  title={
                    session.isDemo
                      ? "About demo notifications"
                      : "Enable notifications"
                  }
                  onPress={notifications}
                />
                {demoControls && (
                  <Card>
                    <Text style={s.title}>Presentation demo</Text>
                    <Text style={s.muted}>
                      Sample data stays in this app session. Reset it to start
                      your walkthrough again.
                    </Text>
                    <Button
                      secondary
                      title={`Switch to ${session.role === "resident" ? "guard" : "resident"}`}
                      onPress={demoControls.switchRole}
                    />
                    <Button
                      secondary
                      title="Reset demo data"
                      onPress={demoControls.reset}
                    />
                  </Card>
                )}
                <Button
                  secondary
                  title="Manage memberships"
                  onPress={() => navigation.navigate("Membership")}
                />
                <Button
                  secondary
                  title="Your activity"
                  onPress={() => navigation.navigate("Activity")}
                />
                <Button secondary title="Sign out" onPress={logout} />
              </Page>
            )}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    </HouseholdProvider>
  );
}
function Shell({
  children,
  demoControls,
}: {
  children: React.ReactNode;
  demoControls?: DemoControls;
}) {
  const snapshot = useSnapshot();
  const session = useSession();
  const nav = useNavigation<NativeStackNavigationProp<Routes>>();
  const route = useRoute();
  const tabs: {
    name:
      | "Home"
      | "Homes"
      | "Community"
      | "Marketplace"
      | "Stores"
      | "Visitors"
      | "Notifications"
      | "Profile";
    label: string;
    icon: React.ComponentProps<typeof Icon>["name"];
  }[] =
    session.role === "resident"
      ? [
          { name: "Home", label: "Social", icon: "view-grid-outline" },
          { name: "Homes", label: "Homes", icon: "home-city-outline" },
          {
            name: "Community",
            label: "Community",
            icon: "account-group-outline",
          },
          {
            name: "Marketplace",
            label: "Buy & Sell",
            icon: "handshake-outline",
          },
          { name: "Stores", label: "Stores", icon: "storefront-outline" },
        ]
      : [
          { name: "Home", label: "Gate", icon: "view-grid-outline" },
          {
            name: "Visitors",
            label: "Visitors",
            icon: "account-group-outline",
          },
          { name: "Community", label: "Community", icon: "home-group" },
          { name: "Notifications", label: "Inbox", icon: "bell-outline" },
          { name: "Profile", label: "Profile", icon: "account-outline" },
        ];
  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: colors.canvas,
        width: "100%",
        maxWidth: session.role === "resident" ? 620 : undefined,
        alignSelf: "center",
      }}
      edges={["top", "bottom", "left", "right"]}
    >
      {demoControls && session.role === "guard" && (
        <Row
          style={{
            backgroundColor: colors.peach,
            paddingHorizontal: 16,
            paddingVertical: 8,
          }}
        >
          <Text style={{ flex: 1, fontSize: 11, fontWeight: "700" }}>
            Demo · Sample data
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Switch to resident"
            onPress={() => {
              void demoControls.switchRole();
            }}
            style={{ paddingVertical: 5, paddingHorizontal: 4 }}
          >
            <Text
              style={{ fontSize: 11, fontWeight: "800", color: colors.teal }}
            >
              Switch to resident →
            </Text>
          </Pressable>
        </Row>
      )}
      {session.role === "resident" ? (
        <ResidentToolbar isTab={tabs.some((tab) => tab.name === route.name)} />
      ) : (
        <Row
          style={{
            minHeight: 73,
            paddingHorizontal: 16,
            borderBottomWidth: 1,
            borderBottomColor: "#DCD9D3",
          }}
        >
          {nav.canGoBack() && !tabs.some((t) => t.name === route.name) && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={() => nav.goBack()}
              style={{ padding: 6 }}
            >
              <Icon name="arrow-left" />
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Manage community"
            onPress={() => nav.navigate("Membership")}
            style={{ flex: 1 }}
          >
            <Text style={{ fontSize: 15, fontWeight: "800" }} numberOfLines={1}>
              {snapshot.community?.name}⌄
            </Text>
            <Text style={{ fontSize: 10, color: colors.muted }}>
              {session.role === "guard"
                ? "Main Gate · Security desk"
                : `${session.ownUnits[0]?.label ?? "Society"} · My Home`}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Search visitors"
            onPress={() => nav.navigate("Visitors")}
            style={{ padding: 7 }}
          >
            <Icon name="magnify" />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            onPress={() => nav.navigate("Notifications")}
            style={{ padding: 7 }}
          >
            <Icon name="bell-outline" />
            {snapshot.notifications.some((n) => !n.read_at) && (
              <View
                style={{
                  position: "absolute",
                  right: 5,
                  top: 3,
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: "#EF5B75",
                }}
              />
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="My profile"
            onPress={() => nav.navigate("Profile")}
            style={{
              backgroundColor: "#985D5E",
              width: 34,
              height: 34,
              borderRadius: 17,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "white" }}>
              {snapshot.user?.name[0] ?? "U"}
            </Text>
          </Pressable>
        </Row>
      )}
      {snapshot.error && (
        <Text
          accessibilityRole="alert"
          style={{ padding: 10, backgroundColor: colors.peach, fontSize: 11 }}
        >
          {snapshot.error}
        </Text>
      )}
      <View style={{ flex: 1 }}>{children}</View>
      <Row
        style={{
          backgroundColor: "white",
          paddingTop: 10,
          paddingBottom: 8,
          borderTopWidth: 1,
          borderTopColor: colors.line,
          gap: 0,
        }}
      >
        {tabs.map((t) => (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: route.name === t.name }}
            accessibilityLabel={t.label}
            key={t.name}
            onPress={() => {
              if (route.name !== t.name) {
                nav.navigate(t.name);
              }
            }}
            style={{ flex: 1, alignItems: "center", gap: 3 }}
          >
            <View
              style={{
                backgroundColor:
                  route.name === t.name ? colors.mint : "transparent",
                paddingHorizontal: 13,
                paddingVertical: 5,
                borderRadius: 12,
              }}
            >
              <Icon name={t.icon} />
            </View>
            <Text
              style={{
                fontSize: 11,
                fontWeight: route.name === t.name ? "800" : "500",
              }}
            >
              {t.label}
            </Text>
          </Pressable>
        ))}
      </Row>
    </SafeAreaView>
  );
}
