import { registerRootComponent } from "expo";
import Constants from "expo-constants";
import { Platform } from "react-native";
import App from "./App";

if (
  Platform.OS !== "web" &&
  !Constants.expoConfig?.extra?.[Platform.OS]?.demo &&
  Constants.expoConfig?.extra?.[Platform.OS]?.configured
) {
  const {
    getMessaging,
    setBackgroundMessageHandler,
  } = require("@react-native-firebase/messaging");
  setBackgroundMessageHandler(getMessaging(), async () => {});
}
registerRootComponent(App);
