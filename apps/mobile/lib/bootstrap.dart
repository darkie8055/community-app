import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app.dart';
import 'data/demo_repository.dart';
import 'domain/models.dart';
import 'state/app_state.dart';
import 'services/backend_session.dart';
import 'services/phone_auth.dart';
import 'ui/theme.dart';

Future<void> bootstrap({required AppRole role, bool preview = false}) async {
  WidgetsFlutterBinding.ensureInitialized();
  final preferences = await SharedPreferences.getInstance();
  const apiUrl = String.fromEnvironment('API_BASE_URL');
  const liveAuth = String.fromEnvironment('AUTH_MODE') == 'firebase';
  if (liveAuth && apiUrl.isEmpty) {
    runApp(
      MaterialApp(
        theme: appTheme(),
        home: const Scaffold(
          body: Center(
            child: Padding(
              padding: EdgeInsets.all(30),
              child: Text(
                'This app is missing its community server configuration. Please contact your society administrator.',
                textAlign: TextAlign.center,
              ),
            ),
          ),
        ),
      ),
    );
    return;
  }
  BackendSession? backend;
  if (apiUrl.isNotEmpty) {
    backend = BackendSession(apiUrl);
    try {
      if (liveAuth) {
        await PhoneAuth.initialize();
        backend.firebaseMode = true;
        backend.hasAccess = false;
        backend.role = role;
      } else {
        await backend.authenticateDemo(role);
      }
    } catch (_) {
      backend.close();
      runApp(
        MaterialApp(
          theme: appTheme(),
          home: Scaffold(
            body: Center(
              child: Padding(
                padding: const EdgeInsets.all(30),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.cloud_off_rounded,
                      size: 42,
                      color: AppColors.coral,
                    ),
                    const SizedBox(height: 20),
                    const Text(
                      'We couldn’t reach your community.',
                      style: TextStyle(
                        fontSize: 21,
                        fontWeight: FontWeight.w800,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'Check that the local MyCommunity API is running, then try again.',
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 22),
                    FilledButton(
                      onPressed: () => bootstrap(role: role, preview: preview),
                      child: const Text('Try again'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
      return;
    }
  }
  runApp(
    ProviderScope(
      overrides: [
        repositoryProvider.overrideWithValue(DemoRepository(preferences)),
        backendProvider.overrideWithValue(backend),
      ],
      child: MyCommunityApp(initialRole: role, preview: preview && !liveAuth),
    ),
  );
}
