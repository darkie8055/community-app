import 'dart:convert';
import 'package:dio/dio.dart';
import '../data/demo_repository.dart' as demo;
import '../data/demo_repository.dart' show DemoRepository;
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'firebase_services.dart';
import '../domain/models.dart';

/// Connects the local development identities to the real NestJS/PostgreSQL API.
/// Production OTP/session exchange replaces authenticateDemo; never enable the
/// backend's DEMO_MODE in production.
class BackendSession {
  BackendSession(String baseUrl)
    : dio = Dio(
        BaseOptions(
          baseUrl: baseUrl,
          connectTimeout: const Duration(seconds: 8),
          receiveTimeout: const Duration(seconds: 15),
        ),
      );
  final Dio dio;
  AppRole role = AppRole.resident;
  List<VisitorEntry> entries = [];
  Map<String, String> units = {};
  List<AppNotification> notifications = [];
  int generation = 0;
  String userName = '';
  String userPhone = '';
  String userId = '';
  String communityId = demo.communityId;
  String communityName = 'Palm Meadows';
  bool firebaseMode = false;
  bool hasAccess = true;
  FirebaseServices? push;
  DateTime? tokenExpiresAt;
  Map<String, String> get ownUnits => {
    for (final m in memberships)
      if (m['status'] == 'approved' &&
          m['unit'] != null &&
          m['unit_id'] != null)
        m['unit'] as String: m['unit_id'] as String,
  };
  List<Map<String, dynamic>> memberships = [];

  Future<void> authenticateDemo(AppRole next) async {
    final response = await dio.post<Map<String, dynamic>>(
      '/v1/auth/demo',
      data: {'role': next.name},
    );
    dio.options.headers['Authorization'] =
        'Bearer ${response.data!['access_token']}';
    role = next;
    hasAccess = true;
    userId = response.data!['user']['sub'] as String;
    userName = response.data!['user']['name'] as String;
    userPhone = response.data!['user']['phone'] as String? ?? '';
    generation++;
    await refresh();
  }

  Future<void> authenticateFirebase(String name) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) throw StateError('Verify your phone number first.');
    final token = await user.getIdToken();
    final response = await dio.post<Map<String, dynamic>>(
      '/v1/auth/firebase',
      data: {'id_token': token, 'name': name},
    );
    dio.options.headers['Authorization'] =
        'Bearer ${response.data!['access_token']}';
    tokenExpiresAt = DateTime.now().add(const Duration(minutes: 55));
    userId = response.data!['user']['sub'];
    userName = response.data!['user']['name'];
    userPhone = response.data!['user']['phone'];
    final communities = (await dio.get<List<dynamic>>('/v1/communities')).data!;
    hasAccess = communities.isNotEmpty;
    if (hasAccess) {
      final selected =
          communities
              .where((dynamic c) => c['id'] == communityId)
              .firstOrNull ??
          communities.first;
      communityId = selected['id'];
      communityName = selected['name'];
      await refresh();
    } else {
      entries = [];
      notifications = [];
      units = {};
      memberships = [];
    }
  }

  Future<void> selectCommunity(String id) async {
    final communities = (await dio.get<List<dynamic>>('/v1/communities')).data!;
    final selected = communities
        .where((dynamic c) => c['id'] == id)
        .firstOrNull;
    if (selected == null) {
      throw StateError('Your membership for this society is not approved.');
    }
    communityId = id;
    communityName = selected['name'];
    generation++;
    entries = [];
    notifications = [];
    units = {};
    memberships = [];
    hasAccess = true;
    await refresh();
  }

  Future<VisitorEntry> visit(String id) async => VisitorEntry.fromJson(
    (await dio.get<Map<String, dynamic>>(
      '/v1/communities/$communityId/visitor-entries/$id',
    )).data!,
  );

  Future<void> refresh() async {
    if (!hasAccess) return;
    if (firebaseMode &&
        tokenExpiresAt != null &&
        DateTime.now().isAfter(tokenExpiresAt!)) {
      await authenticateFirebase(userName);
      return;
    }
    final version = generation;
    final data = await Future.wait<dynamic>([
      dio.get<Map<String, dynamic>>(
        '/v1/communities/$communityId/visitor-entries',
        queryParameters: {'limit': 100},
      ),
      dio.get<Map<String, dynamic>>('/v1/communities/$communityId/structure'),
      dio.get<List<dynamic>>('/v1/notifications'),
      dio.get<List<dynamic>>('/v1/communities/$communityId/my-memberships'),
    ]);
    if (version != generation) return;
    final visits = data[0].data as Map<String, dynamic>;
    entries = (visits['items'] as List)
        .map((v) => VisitorEntry.fromJson(Map<String, dynamic>.from(v)))
        .toList();
    final structure = data[1].data as Map<String, dynamic>;
    units = {
      for (final u in structure['units'] as List)
        u['label'] as String: u['id'] as String,
    };
    notifications = (data[2].data as List)
        .map(
          (n) => AppNotification(
            id: n['id'],
            title: n['title'],
            body: n['body'],
            createdAt: DateTime.parse(n['created_at']).toUtc(),
            entryId: n['entry_id'],
            read: n['read_at'] != null,
          ),
        )
        .toList();
    memberships = (data[3].data as List)
        .map((m) => Map<String, dynamic>.from(m))
        .toList();
  }

  Future<VisitorEntry> register({
    required String name,
    required String phone,
    required VisitType type,
    required String unit,
    required String company,
    required String purpose,
    required int people,
    required String vehicle,
    required bool preapproved,
    String? photo,
    String? requestKey,
  }) async {
    final photoKey = photo == null ? null : await uploadPhoto(photo);
    final result = await dio.post<Map<String, dynamic>>(
      '/v1/communities/$communityId/visitor-entries',
      data: {
        'name': name.trim(),
        'phone': phone,
        'unit_id': units[unit],
        'type': type.name,
        'company': company,
        'purpose': purpose,
        'people': people,
        'vehicle': vehicle,
        'preapproved': preapproved,
        'photo_key': ?photoKey,
      },
      options: Options(
        headers: {'Idempotency-Key': requestKey ?? DemoRepository.uuid.v4()},
      ),
    );
    await refresh();
    return VisitorEntry.fromJson(result.data!);
  }

  Future<void> transition(String id, VisitStatus status) async {
    final action =
        status == VisitStatus.approved || status == VisitStatus.denied
        ? 'decision'
        : status == VisitStatus.inside
        ? 'check-in'
        : 'check-out';
    await dio.post<void>(
      '/v1/communities/$communityId/visitor-entries/$id/$action',
      data: action == 'decision' ? {'decision': status.name} : null,
    );
    await refresh();
  }

  Future<void> markRead() async {
    await dio.post<void>('/v1/notifications/read');
    await refresh();
  }

  Future<void> requestMembership(MembershipRequest request) async {
    await dio.post<void>(
      '/v1/communities/$communityId/memberships',
      data: {
        'unit_id': units[request.unit],
        'role': request.residency.toLowerCase(),
      },
    );
  }

  Future<String> uploadPhoto(String photo) async {
    final bytes = base64Decode(photo);
    if (bytes.length > 2 * 1024 * 1024) {
      throw StateError('Choose a photo smaller than 2 MB.');
    }
    final contentType = bytes.length > 4 && bytes[0] == 0x89
        ? 'image/png'
        : bytes.length > 12 && bytes[0] == 0x52
        ? 'image/webp'
        : 'image/jpeg';
    final upload = (await dio.post<Map<String, dynamic>>(
      '/v1/communities/$communityId/uploads',
      data: {'content_type': contentType, 'size': bytes.length},
    )).data!;
    final client = Dio();
    try {
      await client.put<void>(
        upload['url'],
        data: bytes,
        options: Options(
          headers: {'Content-Type': contentType},
          responseType: ResponseType.plain,
        ),
      );
    } finally {
      client.close();
    }
    return upload['key'] as String;
  }

  void close() => dio.close();

  Future<void> enablePush(void Function(String) onVisit) async {
    if (!firebaseMode || Firebase.apps.isEmpty) {
      throw StateError(
        'Push notifications require a configured Firebase sign-in build.',
      );
    }
    await push?.dispose();
    push = FirebaseServices(
      registerDevice: (token, platform) async {
        await dio.post<void>(
          '/v1/devices',
          data: {'token': token, 'platform': platform},
        );
      },
    );
    await push!.initialize(
      options: Firebase.app().options,
      onVisitorNotification: onVisit,
      onForegroundMessage: (_) async {
        try {
          await refresh();
        } catch (_) {
          /* Normal polling reports connection errors. */
        }
      },
      webVapidKey: const String.fromEnvironment('FIREBASE_VAPID_KEY'),
    );
  }

  Future<void> logout() async {
    if (firebaseMode) {
      try {
        final token = await FirebaseMessaging.instance.getToken();
        if (token != null) {
          await dio.delete<void>(
            '/v1/devices',
            data: {'token': token, 'platform': 'android'},
          );
        }
      } catch (_) {
        /* The device may never have granted notification permission. */
      }
      await push?.dispose();
      await FirebaseAuth.instance.signOut();
    }
    generation++;
    dio.options.headers.remove('Authorization');
    entries = [];
    notifications = [];
    memberships = [];
    hasAccess = false;
  }
}
