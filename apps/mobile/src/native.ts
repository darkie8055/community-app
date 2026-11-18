import { Platform, PermissionsAndroid } from "react-native";
import type { ConfirmationResult } from "@react-native-firebase/auth";
import type { Session } from "./api";

// Lazy imports let an unconfigured build display setup UI without initializing Firebase.
export async function identityToken() {
  const { getAuth, getIdToken } = await import("@react-native-firebase/auth");
  const user = getAuth().currentUser;
  if (!user) throw new Error("Verify your phone number first.");
  return getIdToken(user);
}
export async function sendCode(phone: string): Promise<ConfirmationResult> {
  const { getAuth, signInWithPhoneNumber } =
    await import("@react-native-firebase/auth");
  return signInWithPhoneNumber(getAuth(), `+91${phone}`);
}
export async function observePhoneSignIn(
  phone: string,
  onVerified: () => void,
) {
  const { getAuth, onAuthStateChanged } =
    await import("@react-native-firebase/auth");
  return onAuthStateChanged(getAuth(), (user) => {
    if (user?.phoneNumber === `+91${phone}`) onVerified();
  });
}
export async function signOutNative() {
  const { getAuth, signOut } = await import("@react-native-firebase/auth");
  await signOut(getAuth());
}
export async function restoreIdentity(): Promise<string | null> {
  const { getAuth, onAuthStateChanged } =
    await import("@react-native-firebase/auth");
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(getAuth(), (user) => {
      unsubscribe();
      resolve(user ? user.displayName || "Member" : null);
    });
  });
}
export async function saveIdentityName(name: string) {
  const { getAuth, updateProfile } =
    await import("@react-native-firebase/auth");
  const user = getAuth().currentUser;
  if (user) await updateProfile(user, { displayName: name });
}
export async function reportCrash(error: Error) {
  try {
    const { getCrashlytics, recordError } =
      await import("@react-native-firebase/crashlytics");
    recordError(getCrashlytics(), error);
  } catch {
    /* Unconfigured builds have no native Firebase app. */
  }
}
export async function enablePush(
  session: Session,
  onVisit: (id: string) => void,
) {
  const m = await import("@react-native-firebase/messaging");
  const messaging = m.getMessaging();
  if (Platform.OS === "android" && Number(Platform.Version) >= 33) {
    if (
      (await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      )) !== PermissionsAndroid.RESULTS.GRANTED
    )
      throw new Error(
        "Notifications are disabled. Enable them in device settings.",
      );
  }
  const permission = await m.requestPermission(messaging);
  if (permission < 1)
    throw new Error(
      "Notifications are disabled. Enable them in device settings.",
    );
  if (!messaging.isDeviceRegisteredForRemoteMessages)
    await m.registerDeviceForRemoteMessages(messaging);
  const register = (token: string) =>
    session.request("/v1/devices", "POST", { token, platform: Platform.OS });
  await register(await m.getToken(messaging));
  const open = (message: { data?: Record<string, unknown> }) => {
    const id = message.data?.visitor_entry_id ?? message.data?.entry_id;
    if (typeof id === "string" && /^[a-f\d-]{36}$/i.test(id)) onVisit(id);
  };
  const unsub = [
    m.onTokenRefresh(messaging, (token) => {
      void register(token).catch(() => {});
    }),
    m.onMessage(messaging, () => {
      void session.refresh().catch(() => {});
    }),
    m.onNotificationOpenedApp(messaging, open),
  ];
  const initial = await m.getInitialNotification(messaging);
  if (initial) open(initial);
  return () => unsub.forEach((fn) => fn());
}
export async function unregisterPush(session: Session) {
  try {
    const m = await import("@react-native-firebase/messaging");
    try {
      await session.request("/v1/devices", "DELETE", {
        token: await m.getToken(m.getMessaging()),
        platform: Platform.OS,
      });
    } finally {
      await m.deleteToken(m.getMessaging());
    }
  } catch {
    /* A device may never have registered for push. */
  }
}
