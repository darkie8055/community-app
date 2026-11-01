import 'package:flutter/material.dart';
import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'state/app_state.dart';
import 'ui/widgets.dart';

import 'domain/models.dart';
import 'features/auth/auth_screen.dart';
import 'features/auth/live_auth_screen.dart';
import 'features/catalog/catalog_screen.dart';
import 'features/catalog/item_detail_screen.dart';
import 'features/catalog/item_editor_screen.dart';
import 'features/activity/activity_screen.dart';
import 'features/community/community_screen.dart';
import 'features/community/notifications_screen.dart';
import 'features/guard/guard_home.dart';
import 'features/profile/profile_screen.dart';
import 'features/resident/resident_home.dart';
import 'features/visitors/visitor_detail.dart';
import 'features/visitors/visitor_form.dart';
import 'features/visitors/visitors_screen.dart';
import 'features/visitors/visitor_pass_screen.dart';
import 'features/guard/verify_pass_screen.dart';
import 'ui/app_shell.dart';
import 'ui/theme.dart';

class MyCommunityApp extends ConsumerStatefulWidget {
  const MyCommunityApp({
    super.key,
    this.initialRole = AppRole.resident,
    this.preview = true,
  });
  final AppRole initialRole;
  final bool preview;
  @override
  ConsumerState<MyCommunityApp> createState() => _MyCommunityAppState();
}

class _MyCommunityAppState extends ConsumerState<MyCommunityApp> {
  Timer? refreshTimer;
  bool switching = false;
  @override
  void initState() {
    super.initState();
    if (ref.read(backendProvider) != null) {
      refreshTimer = Timer.periodic(const Duration(seconds: 6), (_) {
        if (!switching && signedIn.value) {
          ref.read(appProvider.notifier).refreshServer();
        }
      });
    }
  }

  late final ValueNotifier<AppRole> role = ValueNotifier(widget.initialRole);
  late final ValueNotifier<bool> signedIn = ValueNotifier(widget.preview);
  late final GoRouter router = GoRouter(
    initialLocation: widget.preview ? '/' : '/login',
    refreshListenable: signedIn,
    redirect: (context, state) {
      final auth = state.uri.path == '/login' || state.uri.path == '/join';
      if (!signedIn.value && !auth) return '/login';
      final backend = ref.read(backendProvider);
      if (state.uri.path == '/verify-pass' && role.value != AppRole.guard) {
        return '/';
      }
      if (state.uri.path.endsWith('/pass') && role.value != AppRole.resident) {
        return '/';
      }
      if (signedIn.value &&
          backend?.firebaseMode == true &&
          !backend!.hasAccess &&
          !auth) {
        return '/join';
      }
      return null;
    },
    routes: [
      GoRoute(
        path: '/login',
        builder: (context, state) =>
            ref.read(backendProvider)?.firebaseMode == true
            ? LiveAuthScreen(
                onSignedIn: () {
                  signedIn.value = true;
                  router.go(
                    ref.read(backendProvider)!.hasAccess ? '/' : '/join',
                  );
                },
              )
            : AuthScreen(
                role: role.value,
                onSignedIn: () async {
                  final backend = ref.read(backendProvider);
                  if (backend != null) {
                    try {
                      await backend.authenticateDemo(role.value);
                      await ref.read(appProvider.notifier).refreshServer();
                    } catch (e) {
                      if (context.mounted) showToast(context, friendlyError(e));
                      return;
                    }
                  }
                  signedIn.value = true;
                  router.go('/');
                },
                preview: widget.preview,
              ),
      ),
      GoRoute(
        path: '/join',
        builder: (context, state) =>
            ref.read(backendProvider)?.firebaseMode == true
            ? const LiveOnboardingScreen()
            : const MembershipScreen(),
      ),
      ShellRoute(
        builder: (context, state, child) => ValueListenableBuilder(
          valueListenable: role,
          builder: (context, value, _) => AppShell(
            role: value,
            location: state.uri.path,
            preview: widget.preview,
            onSwitch: switchRole,
            child: child,
          ),
        ),
        routes: [
          GoRoute(
            path: '/homes',
            builder: (context, state) => const ExploreScreen(kind: 'property'),
          ),
          GoRoute(
            path: '/marketplace',
            builder: (context, state) => const ExploreScreen(kind: 'listing'),
          ),
          GoRoute(
            path: '/stores',
            builder: (context, state) => const ExploreScreen(kind: 'service'),
          ),
          GoRoute(
            path: '/notices',
            builder: (context, state) => const ExploreScreen(kind: 'notice'),
          ),
          GoRoute(
            path: '/item/:id',
            builder: (context, state) =>
                ItemDetailScreen(id: state.pathParameters['id']!),
          ),
          GoRoute(
            path: '/new-item/:kind',
            builder: (context, state) =>
                NewItemScreen(kind: state.pathParameters['kind']!),
          ),
          GoRoute(
            path: '/activity',
            builder: (context, state) => const ActivityScreen(),
          ),
          GoRoute(
            path: '/',
            builder: (context, state) => ValueListenableBuilder(
              valueListenable: role,
              builder: (context, value, _) => value == AppRole.resident
                  ? const ResidentHome()
                  : const GuardHome(),
            ),
          ),
          GoRoute(
            path: '/visitors',
            builder: (context, state) => VisitorsScreen(role: role.value),
          ),
          GoRoute(
            path: '/visitor/:id',
            builder: (context, state) => VisitorDetail(
              id: state.pathParameters['id']!,
              role: role.value,
            ),
          ),
          GoRoute(
            path: '/visitor/:id/pass',
            builder: (_, state) =>
                VisitorPassScreen(id: state.pathParameters['id']!),
          ),
          GoRoute(
            path: '/verify-pass',
            builder: (_, state) => const VerifyPassScreen(),
          ),
          GoRoute(
            path: '/new-visitor',
            builder: (context, state) => VisitorForm(role: role.value),
          ),
          GoRoute(
            path: '/invite',
            builder: (context, state) =>
                VisitorForm(role: role.value, preapproved: true),
          ),
          GoRoute(
            path: '/community',
            builder: (context, state) => CommunityScreen(role: role.value),
          ),
          GoRoute(
            path: '/notifications',
            builder: (context, state) => NotificationsScreen(role: role.value),
          ),
          GoRoute(
            path: '/profile',
            builder: (context, state) => ProfileScreen(
              role: role.value,
              preview: widget.preview,
              onSwitch: switchRole,
              onLogout: () async {
                await ref.read(backendProvider)?.logout();
                signedIn.value = false;
                router.go('/login');
              },
            ),
          ),
        ],
      ),
    ],
  );

  Future<void> switchRole() async {
    if (switching) return;
    switching = true;
    final next = role.value == AppRole.resident
        ? AppRole.guard
        : AppRole.resident;
    try {
      final backend = ref.read(backendProvider);
      if (backend != null) {
        await backend.authenticateDemo(next);
        await ref.read(appProvider.notifier).refreshServer();
      }
      role.value = next;
      router.go('/');
    } catch (e) {
      final ctx = router.routerDelegate.navigatorKey.currentContext;
      if (ctx != null && ctx.mounted) showToast(ctx, friendlyError(e));
    } finally {
      switching = false;
    }
  }

  @override
  void dispose() {
    refreshTimer?.cancel();
    router.dispose();
    role.dispose();
    signedIn.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => MaterialApp.router(
    title: 'MyCommunity · A little more connected',
    debugShowCheckedModeBanner: false,
    theme: appTheme(),
    routerConfig: router,
  );
}
