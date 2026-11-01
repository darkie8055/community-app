import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mycommunity/data/demo_repository.dart';
import 'package:mycommunity/domain/models.dart';
import 'package:mycommunity/domain/visitor_pass.dart';
import 'package:mycommunity/services/content_repository.dart';
import 'package:mycommunity/services/visitor_pass_repository.dart';
import 'package:mycommunity/state/app_state.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'helpers/app_harness.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test(
    'QR parsing accepts formatted codes and rejects foreign or malformed payloads',
    () {
      final pass = VisitorPass(
        entryId: 'test',
        communityId: communityId,
        code: 'ABCDEFGH2345',
        expiresAt: DateTime.now(),
      );
      expect(VisitorPass.parseCode(pass.payload, communityId), pass.code);
      expect(VisitorPass.parseCode('abcd-efgh-2345', communityId), pass.code);
      for (final value in [
        'https://example.com/?code=ABCDEFGH2345',
        'mycommunity://pass/v1?community=other&code=ABCDEFGH2345',
        '${pass.payload}&code=ABCDEFGH2345',
        'ABCD-EFGH-2340',
        'hello',
      ]) {
        expect(
          () => VisitorPass.parseCode(value, communityId),
          throwsFormatException,
        );
      }
    },
  );
  test(
    'local passes persist, rotate, revoke, expire, reject other homes and cannot be reused',
    () async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      final container = ProviderContainer(
        overrides: [
          repositoryProvider.overrideWithValue(DemoRepository(prefs)),
        ],
      );
      addTearDown(container.dispose);
      final controller = container.read(appProvider.notifier);
      final entry = await controller.registerVisitor(
        name: 'QR Guest',
        phone: '9876543210',
        type: VisitType.guest,
        unit: 'A-1204',
        preapproved: true,
      );
      final repo = container.read(visitorPassProvider);
      final pass = await repo.create(entry.id, 24);
      expect((await repo.get(entry.id))!.code, pass.code);
      expect((await repo.verify(pass.payload)).id, entry.id);
      final replacement = await repo.create(entry.id, 6);
      await expectLater(repo.verify(pass.code), throwsStateError);
      await repo.revoke(entry.id);
      await expectLater(repo.verify(replacement.code), throwsStateError);
      final expired = await repo.create(entry.id, 1);
      final saved = jsonDecode(
        prefs.getString('mycommunity.visitor-passes.v1')!,
      );
      saved[entry.id]['expires_at'] = DateTime.now()
          .subtract(const Duration(minutes: 1))
          .toIso8601String();
      await prefs.setString('mycommunity.visitor-passes.v1', jsonEncode(saved));
      await expectLater(repo.verify(expired.code), throwsStateError);
      final active = await repo.create(entry.id, 24);
      expect((await repo.checkIn(active.code)).status, VisitStatus.inside);
      await expectLater(repo.checkIn(active.code), throwsStateError);
      await expectLater(repo.create(entry.id, 24), throwsStateError);
      final other = await controller.registerVisitor(
        name: 'Other Guest',
        phone: '9876543210',
        type: VisitType.guest,
        unit: 'B-802',
      );
      await expectLater(repo.create(other.id, 24), throwsStateError);
    },
  );
  testWidgets(
    'resident generates QR and guard verifies code then records entry',
    (tester) async {
      await mount(tester, const Size(390, 844));
      final context = tester.element(find.byType(Scaffold).first);
      final container = ProviderScope.containerOf(context);
      final entry = await container
          .read(appProvider.notifier)
          .registerVisitor(
            name: 'Shared QR Guest',
            phone: '9876543210',
            type: VisitType.guest,
            unit: 'A-1204',
            preapproved: true,
          );
      GoRouter.of(context).go('/visitor/${entry.id}');
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.byKey(const Key('visitor-share-pass')));
      await tester.tap(find.byKey(const Key('visitor-share-pass')));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.byKey(const Key('generate-pass')));
      await tester.tap(find.byKey(const Key('generate-pass')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('visitor-qr')), findsOneWidget);
      expect(find.byKey(const Key('share-qr')), findsOneWidget);
      final pass = await container.read(visitorPassProvider).get(entry.id);
      expect(pass, isNotNull);
      expect(tester.takeException(), isNull);
      // Use the preview's explicit role switch, keeping the same local storage.
      GoRouter.of(context).go('/profile');
      await tester.pumpAndSettle();
      final switchButton = find.text('Switch to guard app').first;
      await tester.ensureVisible(switchButton);
      await tester.tap(switchButton);
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.byKey(const Key('scan-pass')));
      await tester.tap(find.byKey(const Key('scan-pass')));
      await tester.pumpAndSettle();
      await tester.enterText(
        find.byKey(const Key('pass-code-input')),
        pass!.formattedCode,
      );
      await tester.tap(find.byKey(const Key('verify-pass')));
      await tester.pumpAndSettle();
      expect(find.text('Valid resident invitation'), findsOneWidget);
      await tester.ensureVisible(find.byKey(const Key('pass-check-in')));
      await tester.tap(find.byKey(const Key('pass-check-in')));
      await tester.pumpAndSettle();
      expect(
        container.read(appProvider).entries.first.status,
        VisitStatus.inside,
      );
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
  testWidgets(
    'remaining resident routes render at 360 pixels and own posts accept comments',
    (tester) async {
      await mount(tester, const Size(360, 800));
      final context = tester.element(find.byType(Scaffold).first);
      final router = GoRouter.of(context);
      for (final route in [
        '/notices',
        '/activity',
        '/notifications',
        '/join',
        '/profile',
        '/visitors',
        '/invite',
        '/new-item/post',
        '/new-item/property',
        '/new-item/listing',
      ]) {
        router.go(route);
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull, reason: route);
      }
      final repo = ProviderScope.containerOf(
        context,
      ).read(contentRepositoryProvider);
      await repo.create({
        'kind': 'post',
        'title': 'Community picnic',
        'description': 'Join us this Sunday',
        'status': 'published',
        'category': 'Community',
      });
      final item = (await repo.list('post'))['items'].first;
      router.go('/item/${item['id']}');
      await tester.pumpAndSettle();
      expect(find.text('Add a comment'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
}
