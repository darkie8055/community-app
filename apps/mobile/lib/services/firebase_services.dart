import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import 'phone_auth.dart';

@pragma('vm:entry-point')
Future<void> firebaseBackgroundHandler(RemoteMessage message) async {
  await PhoneAuth.initialize();
}

/// Production integration point. Call after authenticated login and after
/// showing the notification opt-in screen. Not enabled in the demo bootstrap.
class FirebaseServices {
  FirebaseServices({required this.registerDevice});
  final Future<void> Function(String token, String platform) registerDevice;
  StreamSubscription<String>? _tokenSubscription;
  StreamSubscription<RemoteMessage>? _tapSubscription;
  StreamSubscription<RemoteMessage>? _foregroundSubscription;

  Future<void> initialize({
    required FirebaseOptions options,
    required void Function(String entryId) onVisitorNotification,
    void Function(RemoteMessage message)? onForegroundMessage,
    String? webVapidKey,
  }) async {
    if (Firebase.apps.isEmpty) await Firebase.initializeApp(options: options);
    FirebaseMessaging.onBackgroundMessage(firebaseBackgroundHandler);
    if (!kIsWeb) {
      FlutterError.onError =
          FirebaseCrashlytics.instance.recordFlutterFatalError;
      PlatformDispatcher.instance.onError = (error, stack) {
        FirebaseCrashlytics.instance.recordError(error, stack, fatal: true);
        return true;
      };
    }
    final messaging = FirebaseMessaging.instance;
    await messaging.setForegroundNotificationPresentationOptions(
      alert: true,
      badge: true,
      sound: true,
    );
    final settings = await messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );
    if (settings.authorizationStatus == AuthorizationStatus.authorized ||
        settings.authorizationStatus == AuthorizationStatus.provisional) {
      final token = await messaging.getToken(vapidKey: webVapidKey);
      if (token != null) {
        await registerDevice(
          token,
          kIsWeb ? 'web' : defaultTargetPlatform.name,
        );
      }
      _tokenSubscription = messaging.onTokenRefresh.listen((token) async {
        try {
          await registerDevice(
            token,
            kIsWeb ? 'web' : defaultTargetPlatform.name,
          );
        } catch (error, stack) {
          if (!kIsWeb) {
            await FirebaseCrashlytics.instance.recordError(
              error,
              stack,
              reason: 'FCM token registration failed',
            );
          }
        }
      });
    }
    void handle(RemoteMessage message) {
      final id = message.data['visitor_entry_id'];
      if (id is String && id.isNotEmpty) onVisitorNotification(id);
    }

    _tapSubscription = FirebaseMessaging.onMessageOpenedApp.listen(handle);
    _foregroundSubscription = FirebaseMessaging.onMessage.listen((message) {
      onForegroundMessage?.call(message);
    });
    final initial = await messaging.getInitialMessage();
    if (initial != null) handle(initial);
  }

  Future<void> dispose() async {
    await _tokenSubscription?.cancel();
    await _tapSubscription?.cancel();
    await _foregroundSubscription?.cancel();
  }
}
