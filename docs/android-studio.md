# Run the native demo in Android Studio

The native Android application uses local sample data and needs no `.env`, Firebase, database or Expo Go. Metro serves the React Native JavaScript while you develop; the app itself is installed on the Android emulator.

## Prepare the project

From the repository root:

```powershell
npm run android:prepare
```

In Android Studio, select **Open** and choose `apps/mobile/android` inside this project. Open the `android` folder, rather than the repository root. Let Gradle sync finish. Use Android Studio's installed Android SDK and its bundled Gradle JDK.

## Run on an emulator

1. Open **Tools → Device Manager**, create an Android phone if needed, and start it.
2. In a terminal at the repository root, run:

   ```powershell
   npm run android
   ```

This builds and installs the native debug app, starts Metro and opens the demo on the emulator. `npm run android` is an alias for the same native workflow. Keep that terminal running while using the debug app.

## Use Android Studio's Run button

Start Metro in a separate terminal at the repository root:

```powershell
npm run android:metro
```

Then choose the **app** run configuration, your running emulator and the **debug** build variant in Android Studio, and click **Run ▶**. If the development launcher opens first, select the Metro server. On the emulator, its URL is `http://10.0.2.2:8081`. After connecting, the resident demo opens with the guard switch and reset controls.

Use **Profile → Reset demo data** to restart a walkthrough. Data resets when the app reloads. For live backend setup later, see [demo and environment instructions](demo.md).

If a terminal says `adb` is not found, use the provided npm commands: they add the installed SDK's `platform-tools` and `emulator` directories for that process. If Gradle cannot locate the SDK, run `npm run android:prepare` again after installing/configuring the Android SDK in Android Studio.

The workflow uses Expo's [local native build commands](https://docs.expo.dev/guides/local-app-development/), which compile the same Gradle project that Android Studio opens.
