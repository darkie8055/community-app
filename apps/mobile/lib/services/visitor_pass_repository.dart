import 'dart:convert';
import 'dart:math';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/demo_repository.dart' as demo;
import '../domain/models.dart';
import '../domain/visitor_pass.dart';
import '../state/app_state.dart';
import 'backend_session.dart';

final visitorPassProvider = Provider(
  (ref) => VisitorPassRepository(
    ref.read(backendProvider),
    ref.read(repositoryProvider),
    () => ref.read(appProvider).entries,
    (id) => ref
        .read(appProvider.notifier)
        .changeStatus(id, VisitStatus.inside, AppRole.guard),
  ),
);

class VisitorPassRepository {
  VisitorPassRepository(
    this.backend,
    this.local,
    this.entries,
    this.localCheckIn,
  );
  final BackendSession? backend;
  final demo.DemoRepository local;
  final List<VisitorEntry> Function() entries;
  final Future<void> Function(String) localCheckIn;
  static const _key = 'mycommunity.visitor-passes.v1';
  String get community => backend?.communityId ?? demo.communityId;
  String get _base => '/v1/communities/$community';
  Map<String, dynamic> _read() {
    try {
      return Map<String, dynamic>.from(
        jsonDecode(local.preferences.getString(_key) ?? '{}'),
      );
    } on FormatException {
      return {};
    }
  }

  Future<void> _save(Map<String, dynamic> data) async {
    if (!await local.preferences.setString(_key, jsonEncode(data))) {
      throw StateError(
        'The visitor pass could not be saved. Please try again.',
      );
    }
  }

  Future<VisitorEntry> entry(String id) async {
    if (backend != null) return backend!.visit(id);
    final visit = entries()
        .where((e) => e.id == id && e.communityId == community)
        .firstOrNull;
    if (visit == null) throw StateError('Visit not found.');
    return visit;
  }

  Future<void> _ownApproved(String id) async {
    final visit = await entry(id);
    if (visit.unitId != demo.residentUnitId ||
        visit.status != VisitStatus.approved) {
      throw StateError(
        'Only approved visitors to your home can receive a pass.',
      );
    }
  }

  Future<VisitorPass?> get(String id) async {
    if (backend != null) {
      final data = (await backend!.dio.get<Map<String, dynamic>>(
        '$_base/visitor-entries/$id/pass',
      )).data;
      return data == null ? null : VisitorPass.fromJson(data);
    }
    final visit = await entry(id);
    if (visit.unitId != demo.residentUnitId) {
      throw StateError('Visit not found for your home.');
    }
    if (visit.status != VisitStatus.approved) return null;
    final data = _read()[id];
    if (data == null) return null;
    final pass = VisitorPass.fromJson(Map<String, dynamic>.from(data));
    return pass.expired ? null : pass;
  }

  Future<VisitorPass> create(String id, int hours) async {
    if (hours < 1 || hours > 48) throw ArgumentError('Choose 1–48 hours.');
    if (backend != null) {
      return VisitorPass.fromJson(
        (await backend!.dio.post<Map<String, dynamic>>(
          '$_base/visitor-entries/$id/pass',
          data: {'hours': hours},
        )).data!,
      );
    }
    await _ownApproved(id);
    const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    final random = Random.secure();
    final pass = VisitorPass(
      entryId: id,
      communityId: community,
      code: List.generate(
        12,
        (_) => alphabet[random.nextInt(alphabet.length)],
      ).join(),
      expiresAt: DateTime.now().toUtc().add(Duration(hours: hours)),
    );
    await _save({..._read(), id: pass.toJson()});
    return pass;
  }

  Future<void> revoke(String id) async {
    if (backend != null) {
      await backend!.dio.delete<void>('$_base/visitor-entries/$id/pass');
      return;
    }
    final visit = await entry(id);
    if (visit.unitId != demo.residentUnitId) {
      throw StateError('Visit not found for your home.');
    }
    final data = _read()..remove(id);
    await _save(data);
  }

  Future<VisitorEntry> verify(String input) async {
    final code = VisitorPass.parseCode(input, community);
    if (backend != null) {
      return VisitorEntry.fromJson(
        (await backend!.dio.post<Map<String, dynamic>>(
          '$_base/visitor-passes/verify',
          data: {'code': code},
        )).data!,
      );
    }
    final value = _read().values
        .where((p) => p['code'] == code && p['community_id'] == community)
        .firstOrNull;
    if (value != null) {
      final pass = VisitorPass.fromJson(Map<String, dynamic>.from(value));
      final visit = await entry(pass.entryId);
      if (!pass.expired && visit.status == VisitStatus.approved) return visit;
    }
    throw StateError(
      'This pass is invalid, expired, revoked, or already used.',
    );
  }

  Future<VisitorEntry> checkIn(String input) async {
    final code = VisitorPass.parseCode(input, community);
    if (backend != null) {
      return VisitorEntry.fromJson(
        (await backend!.dio.post<Map<String, dynamic>>(
          '$_base/visitor-passes/check-in',
          data: {'code': code},
        )).data!,
      );
    }
    final visit = await verify(input);
    await localCheckIn(visit.id);
    return entry(visit.id);
  }
}
