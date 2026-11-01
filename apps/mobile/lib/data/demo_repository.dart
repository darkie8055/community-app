import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';

import '../domain/models.dart';

const communityId = '937540ee-54e4-424f-85c6-a4db3d06a18a';
const residentUnitId = '4060fc1c-f148-4e50-8cde-1671ea052607';
const demoUnitIds = {
  'A-1204': residentUnitId,
  'A-1205': '441ae942-6fe3-45b0-a61f-98d2ca629437',
  'B-802': 'b5c2ccf3-bb1f-49ea-b503-c98d93549451',
  'C-301': '613dc558-203f-4123-8ba2-f0b2ad068c4e',
};

/// Persistent, single-device demo storage. Never use this for authorization or
/// production visitor data. The NestJS service owns real tenancy and permissions.
class DemoRepository {
  DemoRepository(this.preferences);
  final SharedPreferences preferences;
  static const _key = 'mycommunity.demo.v1';
  static const uuid = Uuid();

  Map<String, dynamic>? read() {
    final raw = preferences.getString(_key);
    if (raw == null) return null;
    try {
      return jsonDecode(raw) as Map<String, dynamic>;
    } on FormatException {
      return null;
    }
  }

  Future<void> save(Map<String, dynamic> data) async {
    if (!await preferences.setString(_key, jsonEncode(data))) {
      throw StateError('Your changes could not be saved on this device.');
    }
  }

  List<VisitorEntry> seedEntries(DateTime now) {
    VisitorEntry entry(
      String name,
      String phone,
      VisitType type,
      VisitStatus status,
      int minutes, {
      String company = '',
      String unit = 'A-1204',
    }) {
      final time = now.subtract(Duration(minutes: minutes)).toUtc();
      return VisitorEntry(
        id: uuid.v4(),
        communityId: communityId,
        unitId: demoUnitIds[unit]!,
        unit: unit,
        name: name,
        phone: phone,
        type: type,
        status: status,
        createdAt: time,
        company: company,
        purpose: type == VisitType.guest ? 'Personal visit' : type.label,
        approvedAt: status == VisitStatus.inside || status == VisitStatus.exited
            ? time.add(const Duration(seconds: 30))
            : null,
        enteredAt: status == VisitStatus.inside || status == VisitStatus.exited
            ? time.add(const Duration(minutes: 1))
            : null,
        exitedAt: status == VisitStatus.exited
            ? time.add(const Duration(minutes: 12))
            : null,
      );
    }

    return [
      entry(
        'Rahul Kumar',
        '9876543210',
        VisitType.delivery,
        VisitStatus.pending,
        2,
        company: 'Amazon',
      ),
      entry(
        'Ananya Sharma',
        '9876543211',
        VisitType.guest,
        VisitStatus.inside,
        32,
      ),
      entry(
        'Vikram Singh',
        '9876543212',
        VisitType.cab,
        VisitStatus.exited,
        75,
        company: 'Uber',
      ),
      entry(
        'Suresh Patel',
        '9876543213',
        VisitType.service,
        VisitStatus.exited,
        120,
        company: 'Urban Company',
      ),
      entry(
        'Arjun Mehta',
        '9876543214',
        VisitType.guest,
        VisitStatus.pending,
        4,
        unit: 'B-802',
      ),
      entry(
        'Deepak Yadav',
        '9876543215',
        VisitType.delivery,
        VisitStatus.exited,
        1440,
        company: 'Swiggy',
      ),
    ];
  }
}
