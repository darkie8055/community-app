import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mycommunity/data/demo_repository.dart';
import 'package:mycommunity/domain/models.dart';
import 'package:mycommunity/state/app_state.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  late ProviderContainer container;
  late SharedPreferences preferences;
  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    preferences = await SharedPreferences.getInstance();
    container = ProviderContainer(
      overrides: [
        repositoryProvider.overrideWithValue(DemoRepository(preferences)),
      ],
    );
  });
  tearDown(() => container.dispose());

  test(
    'guard registers, resident approves, guard records entry and exit',
    () async {
      final controller = container.read(appProvider.notifier);
      final visitor = await controller.registerVisitor(
        name: 'Test Guest',
        phone: '9876543210',
        type: VisitType.guest,
        unit: 'A-1204',
      );
      expect(visitor.status, VisitStatus.pending);
      expect(
        container.read(appProvider).notifications.first.entryId,
        visitor.id,
      );
      await controller.changeStatus(
        visitor.id,
        VisitStatus.approved,
        AppRole.resident,
      );
      await controller.changeStatus(
        visitor.id,
        VisitStatus.inside,
        AppRole.guard,
      );
      await controller.changeStatus(
        visitor.id,
        VisitStatus.exited,
        AppRole.guard,
      );
      final result = container.read(appProvider).entries.first;
      expect(result.status, VisitStatus.exited);
      expect(result.approvedAt, isNotNull);
      expect(result.enteredAt, isNotNull);
      expect(result.exitedAt, isNotNull);
      expect(result.createdAt.isUtc, isTrue);
      expect(result.enteredAt!.isUtc, isTrue);
    },
  );

  test('pending and denied visitors cannot be checked in', () async {
    final controller = container.read(appProvider.notifier);
    final visitor = container.read(appProvider).residentEntries.first;
    await expectLater(
      controller.changeStatus(visitor.id, VisitStatus.inside, AppRole.guard),
      throwsStateError,
    );
    await controller.changeStatus(
      visitor.id,
      VisitStatus.denied,
      AppRole.resident,
    );
    await expectLater(
      controller.changeStatus(visitor.id, VisitStatus.inside, AppRole.guard),
      throwsStateError,
    );
  });

  test('guards cannot approve and residents cannot record entry', () async {
    final controller = container.read(appProvider.notifier);
    final visitor = container.read(appProvider).residentEntries.first;
    await expectLater(
      controller.changeStatus(visitor.id, VisitStatus.approved, AppRole.guard),
      throwsStateError,
    );
    await controller.changeStatus(
      visitor.id,
      VisitStatus.approved,
      AppRole.resident,
    );
    await expectLater(
      controller.changeStatus(visitor.id, VisitStatus.inside, AppRole.resident),
      throwsStateError,
    );
  });

  test('resident list and decisions are scoped to the current home', () async {
    final state = container.read(appProvider);
    expect(
      state.residentEntries.every(
        (e) => e.unitId == residentUnitId && e.communityId == communityId,
      ),
      isTrue,
    );
    final otherHome = state.entries.firstWhere((e) => e.unit == 'B-802');
    await expectLater(
      container
          .read(appProvider.notifier)
          .changeStatus(otherHome.id, VisitStatus.approved, AppRole.resident),
      throwsStateError,
    );
  });

  test(
    'invalid form data and invitations to other homes are rejected',
    () async {
      final controller = container.read(appProvider.notifier);
      await expectLater(
        controller.registerVisitor(
          name: 'T',
          phone: '123',
          type: VisitType.guest,
          unit: 'A-1204',
        ),
        throwsArgumentError,
      );
      await expectLater(
        controller.registerVisitor(
          name: 'Test Guest',
          phone: '9876543210',
          type: VisitType.guest,
          unit: 'B-802',
          preapproved: true,
        ),
        throwsStateError,
      );
    },
  );

  test('completed visits cannot be reopened or checked out twice', () async {
    final controller = container.read(appProvider.notifier);
    final visitor = container
        .read(appProvider)
        .entries
        .firstWhere((e) => e.status == VisitStatus.exited);
    await expectLater(
      controller.changeStatus(visitor.id, VisitStatus.exited, AppRole.guard),
      throwsStateError,
    );
    await expectLater(
      controller.changeStatus(visitor.id, VisitStatus.inside, AppRole.guard),
      throwsStateError,
    );
  });

  test('decisions and read state survive a repository reload', () async {
    final controller = container.read(appProvider.notifier);
    final visitor = container.read(appProvider).residentEntries.first;
    await controller.changeStatus(
      visitor.id,
      VisitStatus.approved,
      AppRole.resident,
    );
    await controller.markAllRead();
    final reloaded = ProviderContainer(
      overrides: [
        repositoryProvider.overrideWithValue(DemoRepository(preferences)),
      ],
    );
    addTearDown(reloaded.dispose);
    expect(
      reloaded
          .read(appProvider)
          .entries
          .firstWhere((e) => e.id == visitor.id)
          .status,
      VisitStatus.approved,
    );
    expect(reloaded.read(appProvider).unread, 0);
  });

  test('membership remains pending and survives reload', () async {
    await container
        .read(appProvider.notifier)
        .requestMembership(
          const MembershipRequest(
            name: 'Test Resident',
            phone: '9876543210',
            unit: 'C-301',
            residency: 'Tenant',
          ),
        );
    final reloaded = ProviderContainer(
      overrides: [
        repositoryProvider.overrideWithValue(DemoRepository(preferences)),
      ],
    );
    addTearDown(reloaded.dispose);
    expect(reloaded.read(appProvider).membership!.status, 'pending');
    expect(reloaded.read(appProvider).membership!.unit, 'C-301');
  });
}
