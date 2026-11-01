import 'package:flutter/material.dart';

enum AppRole { resident, guard }

enum VisitStatus {
  pending('Waiting', Color(0xFFAA6C16), Color(0xFFFFF4DB)),
  approved('Approved', Color(0xFF278366), Color(0xFFEAF5EF)),
  denied('Denied', Color(0xFFBC4A48), Color(0xFFFFEEEE)),
  inside('Inside', Color(0xFF278366), Color(0xFFEAF5EF)),
  exited('Exited', Color(0xFF79818A), Color(0xFFF0F2F4));

  const VisitStatus(this.label, this.color, this.background);
  final String label;
  final Color color;
  final Color background;
}

enum VisitType {
  guest('Guest', Icons.person_outline_rounded, Color(0xFF7486B6)),
  delivery('Delivery', Icons.inventory_2_outlined, Color(0xFFC28A4F)),
  cab('Cab', Icons.local_taxi_outlined, Color(0xFF648F82)),
  service('Service', Icons.handyman_outlined, Color(0xFFAB7D9D));

  const VisitType(this.label, this.icon, this.color);
  final String label;
  final IconData icon;
  final Color color;
}

class VisitorEntry {
  const VisitorEntry({
    required this.id,
    required this.communityId,
    required this.unitId,
    required this.unit,
    required this.name,
    required this.phone,
    required this.type,
    required this.status,
    required this.createdAt,
    this.company = '',
    this.purpose = '',
    this.people = 1,
    this.vehicle = '',
    this.photoBase64,
    this.photoUrl,
    this.approvedAt,
    this.deniedAt,
    this.enteredAt,
    this.exitedAt,
  });

  final String id,
      communityId,
      unitId,
      unit,
      name,
      phone,
      company,
      purpose,
      vehicle;
  final VisitType type;
  final VisitStatus status;
  final int people;
  final String? photoBase64, photoUrl;
  final DateTime createdAt;
  final DateTime? approvedAt, deniedAt, enteredAt, exitedAt;

  String get initials => name
      .trim()
      .split(RegExp(r'\s+'))
      .take(2)
      .map((p) => p[0])
      .join()
      .toUpperCase();
  String get description =>
      company.isEmpty ? type.label : '$company · ${type.label}';

  VisitorEntry transition(VisitStatus next, DateTime now) {
    final valid = switch (status) {
      VisitStatus.pending =>
        next == VisitStatus.approved || next == VisitStatus.denied,
      VisitStatus.approved => next == VisitStatus.inside,
      VisitStatus.inside => next == VisitStatus.exited,
      _ => false,
    };
    if (!valid) {
      throw StateError('Cannot move from ${status.name} to ${next.name}.');
    }
    return VisitorEntry(
      id: id,
      communityId: communityId,
      unitId: unitId,
      unit: unit,
      name: name,
      phone: phone,
      type: type,
      status: next,
      createdAt: createdAt,
      company: company,
      purpose: purpose,
      people: people,
      vehicle: vehicle,
      photoBase64: photoBase64,
      photoUrl: photoUrl,
      approvedAt: next == VisitStatus.approved ? now.toUtc() : approvedAt,
      deniedAt: next == VisitStatus.denied ? now.toUtc() : deniedAt,
      enteredAt: next == VisitStatus.inside ? now.toUtc() : enteredAt,
      exitedAt: next == VisitStatus.exited ? now.toUtc() : exitedAt,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'community_id': communityId,
    'unit_id': unitId,
    'unit': unit,
    'name': name,
    'phone': phone,
    'type': type.name,
    'status': status.name,
    'created_at': createdAt.toUtc().toIso8601String(),
    'approved_at': approvedAt?.toUtc().toIso8601String(),
    'denied_at': deniedAt?.toUtc().toIso8601String(),
    'entered_at': enteredAt?.toUtc().toIso8601String(),
    'exited_at': exitedAt?.toUtc().toIso8601String(),
    'company': company,
    'purpose': purpose,
    'people': people,
    'vehicle': vehicle,
    'photo_base64': photoBase64,
    'photo_url': photoUrl,
  };

  factory VisitorEntry.fromJson(Map<String, dynamic> json) => VisitorEntry(
    id: json['id'] as String,
    communityId: json['community_id'] as String,
    unitId: json['unit_id'] as String,
    unit: json['unit'] as String,
    name: json['name'] as String,
    phone: json['phone'] as String,
    type: VisitType.values.byName(json['type'] as String),
    status: VisitStatus.values.byName(json['status'] as String),
    createdAt: DateTime.parse(json['created_at'] as String).toUtc(),
    approvedAt: DateTime.tryParse(
      json['approved_at'] as String? ?? '',
    )?.toUtc(),
    deniedAt: DateTime.tryParse(json['denied_at'] as String? ?? '')?.toUtc(),
    enteredAt: DateTime.tryParse(json['entered_at'] as String? ?? '')?.toUtc(),
    exitedAt: DateTime.tryParse(json['exited_at'] as String? ?? '')?.toUtc(),
    company: json['company'] as String? ?? '',
    purpose: json['purpose'] as String? ?? '',
    people: json['people'] as int? ?? 1,
    vehicle: json['vehicle'] as String? ?? '',
    photoBase64: json['photo_base64'] as String?,
    photoUrl: json['photo_url'] as String?,
  );
}

class AppNotification {
  const AppNotification({
    required this.id,
    required this.title,
    required this.body,
    required this.createdAt,
    this.entryId,
    this.read = false,
  });
  final String id, title, body;
  final DateTime createdAt;
  final String? entryId;
  final bool read;
  AppNotification markRead() => AppNotification(
    id: id,
    title: title,
    body: body,
    createdAt: createdAt,
    entryId: entryId,
    read: true,
  );
  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'body': body,
    'created_at': createdAt.toUtc().toIso8601String(),
    'entry_id': entryId,
    'read': read,
  };
  factory AppNotification.fromJson(Map<String, dynamic> j) => AppNotification(
    id: j['id'],
    title: j['title'],
    body: j['body'],
    createdAt: DateTime.parse(j['created_at']).toUtc(),
    entryId: j['entry_id'],
    read: j['read'] ?? false,
  );
}

class MembershipRequest {
  const MembershipRequest({
    required this.name,
    required this.phone,
    required this.unit,
    required this.residency,
    this.status = 'pending',
  });
  final String name, phone, unit, residency, status;
  Map<String, dynamic> toJson() => {
    'name': name,
    'phone': phone,
    'unit': unit,
    'residency': residency,
    'status': status,
  };
  factory MembershipRequest.fromJson(Map<String, dynamic> j) =>
      MembershipRequest(
        name: j['name'],
        phone: j['phone'],
        unit: j['unit'],
        residency: j['residency'],
        status: j['status'],
      );
}
