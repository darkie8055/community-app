import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mycommunity/app.dart';
import 'package:mycommunity/data/demo_repository.dart';
import 'package:mycommunity/domain/models.dart';
import 'package:mycommunity/state/app_state.dart';
import 'package:shared_preferences/shared_preferences.dart';

Future<void> mount(
  WidgetTester tester,
  Size size, {
  AppRole role = AppRole.resident,
  bool preview = true,
}) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  SharedPreferences.setMockInitialValues({});
  final repo = DemoRepository(await SharedPreferences.getInstance());
  await tester.pumpWidget(
    ProviderScope(
      overrides: [repositoryProvider.overrideWithValue(repo)],
      child: MyCommunityApp(initialRole: role, preview: preview),
    ),
  );
  await tester.pumpAndSettle();
}
