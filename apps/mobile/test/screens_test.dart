import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'helpers/app_harness.dart';
import 'package:mycommunity/domain/models.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() async {
    final fonts = FontLoader('Manrope')
      ..addFont(rootBundle.load('assets/fonts/Manrope.ttf'));
    await fonts.load();
  });
  testWidgets('resident home has no overflow on a small phone', (tester) async {
    await mount(tester, const Size(360, 800));
    expect(find.text('Social'), findsOneWidget);
    expect(find.text('Quick actions'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'resident approval updates guard view and entry can be recorded',
    (tester) async {
      await mount(tester, const Size(1440, 1000));
      await tester.tap(find.byKey(const Key('home-approve')));
      await tester.pumpAndSettle();
      expect(find.text('You’re all caught up'), findsOneWidget);
      await tester.tap(find.text('Switch to guard app'));
      await tester.pumpAndSettle();
      expect(find.text('A safe community starts here.'), findsOneWidget);
      await tester.tap(find.text('Record entry').first);
      await tester.pumpAndSettle();
      expect(find.text('Record entry'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('guard form validates then creates a pending visit', (
    tester,
  ) async {
    await mount(tester, const Size(390, 844), role: AppRole.guard);
    await tester.tap(find.byKey(const Key('new-visitor')));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.byKey(const Key('submit-visitor')));
    await tester.tap(find.byKey(const Key('submit-visitor')));
    await tester.pumpAndSettle();
    expect(find.text('Enter the visitor’s full name'), findsOneWidget);
    await tester.ensureVisible(find.byKey(const Key('visitor-name')));
    await tester.enterText(find.byKey(const Key('visitor-name')), 'Meera Rao');
    await tester.enterText(
      find.byKey(const Key('visitor-phone')),
      '9876543210',
    );
    await tester.ensureVisible(find.byKey(const Key('submit-visitor')));
    await tester.tap(find.byKey(const Key('submit-visitor')));
    await tester.pumpAndSettle();
    expect(find.text('Meera Rao'), findsOneWidget);
    expect(
      find.text('Waiting for the resident to approve. Do not allow entry yet.'),
      findsOneWidget,
    );
    expect(find.byKey(const Key('record-entry')), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('visitor search filters unrelated visitors', (tester) async {
    await mount(tester, const Size(1440, 1000));
    await tester.tap(find.byTooltip('Search visitors'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('visitor-search')), 'Ananya');
    await tester.pumpAndSettle();
    expect(find.text('Ananya Sharma'), findsOneWidget);
    expect(find.text('Rahul Kumar'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('demo login validates code then opens sample profile', (
    tester,
  ) async {
    await mount(tester, const Size(390, 844), preview: false);
    await tester.enterText(find.byKey(const Key('login-phone')), '9876543210');
    await tester.tap(find.text('Get demo code'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('login-code')), '000000');
    await tester.tap(find.text('Verify & explore'));
    await tester.pumpAndSettle();
    expect(find.text('Use the demo code 123456'), findsOneWidget);
    await tester.enterText(find.byKey(const Key('login-code')), '123456');
    await tester.tap(find.text('Verify & explore'));
    await tester.pumpAndSettle();
    expect(find.text('Social'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Homes, marketplace, community and services fit a small phone', (
    tester,
  ) async {
    await mount(tester, const Size(360, 800));
    for (final tab in ['Homes', 'Buy & Sell', 'Stores', 'Community']) {
      await tester.tap(find.text(tab).last);
      await tester.pumpAndSettle();
      expect(
        tester.takeException(),
        isNull,
        reason: 'Overflow or failure on $tab',
      );
    }
  });

  testWidgets(
    'a resident can draft, publish, save and close a marketplace listing',
    (tester) async {
      await mount(tester, const Size(390, 844));
      await tester.tap(find.text('Buy & Sell').last);
      await tester.pumpAndSettle();
      await tester.tap(find.text('New Listing'));
      await tester.pumpAndSettle();
      await tester.enterText(
        find.byType(TextFormField).at(0),
        'Balcony reading chair',
      );
      await tester.enterText(
        find.byType(TextFormField).at(1),
        'Comfortable chair in excellent condition.',
      );
      await tester.enterText(find.byType(TextFormField).at(2), '1200');
      await tester.ensureVisible(find.text('Save draft'));
      await tester.tap(find.text('Save draft'));
      await tester.pumpAndSettle();
      expect(find.byTooltip('My listings'), findsOneWidget);
      await tester.tap(find.byTooltip('My listings'));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Balcony reading chair'));
      await tester.tap(find.text('Balcony reading chair'));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Publish listing'));
      await tester.tap(find.text('Publish listing'));
      await tester.pumpAndSettle();
      expect(find.text('Mark unavailable'), findsOneWidget);
      await tester.ensureVisible(find.byTooltip('Save item'));
      await tester.tap(find.byTooltip('Save item'));
      await tester.pumpAndSettle();
      final prefs = await SharedPreferences.getInstance();
      var item =
          (jsonDecode(prefs.getString('mycommunity.content.v1')!)['items']
                  as List)
              .firstWhere((i) => i['title'] == 'Balcony reading chair');
      expect(item['saved'], isTrue);
      expect(item['status'], 'published');
      await tester.ensureVisible(find.text('Mark unavailable'));
      await tester.tap(find.text('Mark unavailable'));
      await tester.pumpAndSettle();
      item =
          (jsonDecode(prefs.getString('mycommunity.content.v1')!)['items']
                  as List)
              .firstWhere((i) => i['title'] == 'Balcony reading chair');
      expect(item['status'], 'closed');
      expect(tester.takeException(), isNull);
    },
  );
}
