import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/demo_repository.dart';
import '../domain/models.dart';
import '../services/backend_session.dart';

final backendProvider = Provider<BackendSession?>((ref) => null);

final repositoryProvider = Provider<DemoRepository>(
  (ref) => throw UnimplementedError('Override at startup'),
);
final appProvider = NotifierProvider<AppController, AppState>(
  AppController.new,
);

class AppState {
  const AppState({
    required this.entries,
    required this.notifications,
    this.membership,
    this.error,
    this.serverScoped = false,
  });
  final List<VisitorEntry> entries;
  final List<AppNotification> notifications;
  final MembershipRequest? membership;
  final String? error;
  final bool serverScoped;
  List<VisitorEntry> get residentEntries => serverScoped
      ? entries
      : entries
            .where(
              (v) => v.communityId == communityId && v.unitId == residentUnitId,
            )
            .toList();
  int get unread => notifications.where((n) => !n.read).length;
}

class AppController extends Notifier<AppState> {
  Future<void> _writes = Future.value();
  @override
  AppState build() {
    final backend = ref.read(backendProvider);
    if (backend != null) {
      return AppState(
        entries: backend.entries,
        notifications: backend.notifications,
        serverScoped: true,
      );
    }
    final repo = ref.read(repositoryProvider);
    final saved = repo.read();
    if (saved != null) {
      try {
        return AppState(
          entries: (saved['entries'] as List)
              .map((v) => VisitorEntry.fromJson(Map<String, dynamic>.from(v)))
              .toList(),
          notifications: (saved['notifications'] as List)
              .map(
                (v) => AppNotification.fromJson(Map<String, dynamic>.from(v)),
              )
              .toList(),
          membership: saved['membership'] == null
              ? null
              : MembershipRequest.fromJson(
                  Map<String, dynamic>.from(saved['membership']),
                ),
        );
      } catch (_) {
        /* An incompatible demo snapshot can be replaced safely. */
      }
    }
    final entries = repo.seedEntries(DateTime.now().toUtc());
    // Keep seeded IDs stable across reloads, including direct visit deep links.
    Future.microtask(() {
      if (ref.mounted) _save();
    });
    return AppState(
      entries: entries,
      notifications: [
        AppNotification(
          id: DemoRepository.uuid.v4(),
          title: 'Rahul Kumar is at the gate',
          body: 'An Amazon delivery is waiting for your approval.',
          createdAt: entries.first.createdAt,
          entryId: entries.first.id,
        ),
        AppNotification(
          id: DemoRepository.uuid.v4(),
          title: 'Welcome to your community',
          body: 'Your home, your neighbours, and a little more peace of mind.',
          createdAt: DateTime.now().toUtc().subtract(const Duration(hours: 3)),
        ),
      ],
    );
  }

  Future<void> _save() {
    if (ref.read(backendProvider) != null) return Future.value();
    final snapshot = {
      'entries': state.entries.map((e) => e.toJson()).toList(),
      'notifications': state.notifications.map((e) => e.toJson()).toList(),
      'membership': state.membership?.toJson(),
    };
    final repository = ref.read(repositoryProvider);
    _writes = _writes.then((_) => repository.save(snapshot)).catchError((
      Object error,
    ) {
      if (ref.mounted) {
        state = AppState(
          entries: state.entries,
          notifications: state.notifications,
          membership: state.membership,
          error: error.toString(),
        );
      }
    });
    return _writes;
  }

  Future<void> changeStatus(String id, VisitStatus next, AppRole actor) async {
    final backend = ref.read(backendProvider);
    if (backend != null) {
      await backend.transition(id, next);
      _adoptServer();
      return;
    }
    final entry = state.entries.firstWhere(
      (v) => v.id == id && v.communityId == communityId,
    );
    if (actor == AppRole.resident &&
        (entry.unitId != residentUnitId ||
            (next != VisitStatus.approved && next != VisitStatus.denied))) {
      throw StateError(
        'Residents can only decide requests for their own home.',
      );
    }
    if (actor == AppRole.guard &&
        next != VisitStatus.inside &&
        next != VisitStatus.exited) {
      throw StateError('Only the resident can approve or deny this visitor.');
    }
    final updated = entry.transition(next, DateTime.now().toUtc());
    final isOwnUnit = entry.unitId == residentUnitId;
    final notification = AppNotification(
      id: DemoRepository.uuid.v4(),
      title: '${entry.name} · ${next.label}',
      body:
          '${entry.type.label} for ${entry.unit}. Your visitor log has been updated.',
      createdAt: DateTime.now().toUtc(),
      entryId: entry.id,
    );
    state = AppState(
      entries: [
        for (final v in state.entries)
          if (v.id == id) updated else v,
      ],
      notifications: [if (isOwnUnit) notification, ...state.notifications],
      membership: state.membership,
    );
    await _save();
  }

  Future<VisitorEntry> registerVisitor({
    required String name,
    required String phone,
    required VisitType type,
    required String unit,
    String company = '',
    String purpose = '',
    int people = 1,
    String vehicle = '',
    String? photoBase64,
    String? requestKey,
    bool preapproved = false,
  }) async {
    final backend = ref.read(backendProvider);
    if (backend != null) {
      final entry = await backend.register(
        name: name,
        phone: phone,
        type: type,
        unit: unit,
        company: company,
        purpose: purpose,
        people: people,
        vehicle: vehicle,
        photo: photoBase64,
        requestKey: requestKey,
        preapproved: preapproved,
      );
      _adoptServer();
      return entry;
    }
    if (name.trim().length < 2 ||
        !RegExp(r'^[6-9]\d{9}$').hasMatch(phone) ||
        !demoUnitIds.containsKey(unit) ||
        people < 1 ||
        people > 20) {
      throw ArgumentError(
        'Enter a valid name, Indian mobile number, flat, and guest count.',
      );
    }
    if (preapproved && unit != 'A-1204') {
      throw StateError('You can only invite guests to your own home.');
    }
    final entry = VisitorEntry(
      id: DemoRepository.uuid.v4(),
      communityId: communityId,
      unitId: demoUnitIds[unit]!,
      unit: unit,
      name: name.trim(),
      phone: phone,
      type: type,
      status: preapproved ? VisitStatus.approved : VisitStatus.pending,
      createdAt: DateTime.now().toUtc(),
      approvedAt: preapproved ? DateTime.now().toUtc() : null,
      company: company.trim(),
      purpose: purpose.trim(),
      people: people,
      vehicle: vehicle.trim(),
      photoBase64: photoBase64,
    );
    state = AppState(
      entries: [entry, ...state.entries],
      notifications: [
        if (unit == 'A-1204')
          AppNotification(
            id: DemoRepository.uuid.v4(),
            title: preapproved
                ? 'Your guest is expected'
                : '$name is at the gate',
            body: preapproved
                ? 'Security can check in $name when they arrive.'
                : '${type.label} waiting for approval at Main Gate.',
            createdAt: entry.createdAt,
            entryId: entry.id,
          ),
        ...state.notifications,
      ],
      membership: state.membership,
    );
    await _save();
    return entry;
  }

  Future<void> markAllRead() async {
    final backend = ref.read(backendProvider);
    if (backend != null) {
      await backend.markRead();
      _adoptServer();
      return;
    }
    state = AppState(
      entries: state.entries,
      notifications: state.notifications.map((n) => n.markRead()).toList(),
      membership: state.membership,
    );
    await _save();
  }

  Future<void> requestMembership(MembershipRequest request) async {
    final backend = ref.read(backendProvider);
    if (backend != null) await backend.requestMembership(request);
    state = AppState(
      entries: state.entries,
      notifications: state.notifications,
      membership: request,
    );
    await _save();
  }

  Future<void> resetDemo() async {
    if (ref.read(backendProvider) != null) return;
    final entries = ref
        .read(repositoryProvider)
        .seedEntries(DateTime.now().toUtc());
    state = AppState(entries: entries, notifications: []);
    await _save();
  }

  void _adoptServer() {
    final backend = ref.read(backendProvider);
    if (backend != null && ref.mounted) {
      var membership = state.membership;
      final row = backend.memberships
          .where((m) => m['unit'] == membership?.unit)
          .firstOrNull;
      if (row != null && membership != null) {
        membership = MembershipRequest(
          name: membership.name,
          phone: membership.phone,
          unit: membership.unit,
          residency: membership.residency,
          status: row['status'] as String,
        );
      }
      state = AppState(
        entries: backend.entries,
        notifications: backend.notifications,
        membership: membership,
        serverScoped: true,
      );
    }
  }

  Future<void> refreshServer() async {
    final backend = ref.read(backendProvider);
    if (backend == null) return;
    try {
      await backend.refresh();
      _adoptServer();
    } catch (_) {
      if (ref.mounted) {
        state = AppState(
          entries: state.entries,
          notifications: state.notifications,
          membership: state.membership,
          error:
              'Connection interrupted. Your last loaded visits are shown. Reconnecting…',
          serverScoped: true,
        );
      }
    }
  }
}
