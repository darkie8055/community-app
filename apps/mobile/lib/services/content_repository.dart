import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/demo_repository.dart';
import '../state/app_state.dart';
import 'backend_session.dart';

final contentRepositoryProvider = Provider(
  (ref) => ContentRepository(
    ref.read(backendProvider),
    ref.read(repositoryProvider),
  ),
);

class ContentRepository {
  ContentRepository(this.backend, this.demo);
  final BackendSession? backend;
  final DemoRepository demo;
  String get userId => backend?.userId ?? 'local-resident';
  String get base => '/v1/communities/${backend?.communityId ?? communityId}';
  Map<String, String> get homes =>
      backend?.ownUnits ?? {'A-1204': residentUnitId};
  Future<Map<String, dynamic>> list(
    String kind, {
    String search = '',
    String category = '',
    bool saved = false,
    bool mine = false,
    String? cursor,
  }) async {
    if (backend != null) {
      return (await backend!.dio.get<Map<String, dynamic>>(
        '$base/items',
        queryParameters: {
          'kind': kind,
          'limit': 50,
          if (search.isNotEmpty) 'search': search,
          if (category.isNotEmpty) 'category': category,
          if (saved) 'saved': 'true',
          if (mine) 'mine': 'true',
          'cursor': ?cursor,
        },
      )).data!;
    }
    final items = _state()['items'] as List;
    return {
      'items': items
          .where(
            (dynamic i) =>
                i['kind'] == kind &&
                (i['status'] == 'published' || i['author_id'] == userId) &&
                (!saved || i['saved'] == true) &&
                (!mine || i['author_id'] == userId) &&
                (category.isEmpty || i['category'] == category) &&
                (search.isEmpty ||
                    '${i['title']} ${i['description']}'.toLowerCase().contains(
                      search.toLowerCase(),
                    )),
          )
          .toList(),
      'next_cursor': null,
    };
  }

  Future<Map<String, dynamic>> detail(String id) async {
    if (backend != null) {
      return (await backend!.dio.get<Map<String, dynamic>>(
        '$base/items/$id',
      )).data!;
    }
    return Map<String, dynamic>.from(
      (_state()['items'] as List).firstWhere((dynamic i) => i['id'] == id),
    );
  }

  Future<void> create(Map<String, dynamic> data) async {
    data = Map<String, dynamic>.from(data);
    if (backend != null) {
      final image = data.remove('photo_base64') as String?;
      if (image != null) data['photo_key'] = await backend!.uploadPhoto(image);
      await backend!.dio.post<void>('$base/items', data: data);
      return;
    }
    final state = _state();
    (state['items'] as List).insert(0, {
      ...data,
      'id': DemoRepository.uuid.v4(),
      'author_id': userId,
      'author': 'Aarav Sharma',
      'community': 'Palm Meadows',
      'unit': 'A-1204',
      'created_at': DateTime.now().toUtc().toIso8601String(),
      'saved': false,
      'comments': [],
      'comment_count': 0,
    });
    await _save(state);
  }

  Future<void> action(
    String id,
    String action, [
    Map<String, dynamic>? data,
  ]) async {
    if (backend != null) {
      await backend!.dio.post<void>('$base/items/$id/$action', data: data);
      return;
    }
    final state = _state();
    final item = (state['items'] as List).firstWhere(
      (dynamic i) => i['id'] == id,
    );
    switch (action) {
      case 'bookmark':
        item['saved'] = item['saved'] != true;
      case 'status':
        item['status'] = data!['status'];
      case 'comments':
        (item['comments'] as List).add({
          'author': 'Aarav Sharma',
          'body': data!['message'],
          'created_at': DateTime.now().toUtc().toIso8601String(),
        });
        item['comment_count'] = (item['comments'] as List).length;
      case 'inquiries':
        (state['inquiries'] as List).insert(0, {
          'id': DemoRepository.uuid.v4(),
          'title': item['title'],
          'message': data!['message'],
          'sender': 'Aarav Sharma',
          'sender_id': userId,
          'recipient': item['author'],
          'recipient_id': item['author_id'],
        });
      case 'requests':
        (state['requests'] as List).insert(0, {
          ...data!,
          'id': DemoRepository.uuid.v4(),
          'title': item['title'],
          'status': 'requested',
          'unit': 'A-1204',
        });
    }
    await _save(state);
  }

  Future<List<dynamic>> activity(String kind) async {
    if (backend != null) {
      return (await backend!.dio.get<List<dynamic>>(
        '$base/${kind == 'requests' ? 'service-requests' : 'inquiries'}',
      )).data!;
    }
    return _state()[kind] as List;
  }

  Future<void> cancel(String id) async {
    if (backend != null) {
      await backend!.dio.post<void>(
        '$base/service-requests/$id/status',
        data: {'status': 'cancelled'},
      );
      return;
    }
    final state = _state();
    (state['requests'] as List).firstWhere(
      (dynamic r) => r['id'] == id,
    )['status'] = 'cancelled';
    await _save(state);
  }

  Future<void> reply(String id, String message) async {
    if (backend != null) {
      await backend!.dio.post<void>(
        '$base/inquiries/$id/reply',
        data: {'message': message},
      );
      return;
    }
    final state = _state();
    (state['inquiries'] as List).firstWhere(
      (dynamic r) => r['id'] == id,
    )['reply'] = message;
    await _save(state);
  }

  Future<void> _save(Map<String, dynamic> value) async {
    if (!await demo.preferences.setString(
      'mycommunity.content.v1',
      jsonEncode(value),
    )) {
      throw StateError('Could not save your changes.');
    }
  }

  Map<String, dynamic> _state() {
    final raw = demo.preferences.getString('mycommunity.content.v1');
    if (raw != null) return jsonDecode(raw) as Map<String, dynamic>;
    final samples = [
      [
        'property',
        'A bright 3 BHK to call home',
        'Sunlit rooms, two balconies and a view of the gardens.',
        'Rent',
        42000,
        'house',
      ],
      [
        'property',
        'Garden-facing 2 BHK apartment',
        'A thoughtfully planned home with covered parking.',
        'Buy',
        9200000,
        'house',
      ],
      [
        'listing',
        'A comfortable accent chair',
        'Well cared for. Pick up within the society.',
        'Furniture',
        2500,
        'chair',
      ],
      [
        'listing',
        'Three-seater fabric sofa',
        'Clean fabric sofa with removable covers.',
        'Furniture',
        8500,
        'sofa',
      ],
      [
        'listing',
        'City bicycle, ready to ride',
        'Serviced recently. Helmet included.',
        'Vehicles',
        4500,
        'bicycle',
      ],
      [
        'listing',
        'Handmade wall decor',
        'Two hand-painted pieces made by a neighbour.',
        'Home Decor',
        750,
        'decor',
      ],
      [
        'listing',
        'Desk chair, free to a neighbour',
        'Collect from Tower B this weekend.',
        'Free',
        0,
        'chair',
      ],
      [
        'service',
        'Home deep cleaning',
        'Choose a date. The society desk will confirm availability.',
        'Cleaning',
        2499,
        'cleaning',
      ],
      [
        'service',
        'AC service and repair',
        'Inspection, filter cleaning and servicing.',
        'Appliance Repair',
        599,
        'ac',
      ],
      [
        'service',
        'Packers and movers',
        'Plan your move with the society desk.',
        'Moving',
        3500,
        'moving',
      ],
      [
        'service',
        'Fresh walls, fresh beginnings',
        'Book a painting inspection for your home.',
        'Painting',
        499,
        'painting',
      ],
      [
        'post',
        'Sunday morning, a little greener',
        'Join a garden clean-up this Sunday at 8 AM. Meet by the clubhouse. Everyone is welcome.',
        'Community',
        0,
        'community',
      ],
      [
        'post',
        'Anyone up for a weekend book swap?',
        'I have a few novels looking for their next reader. Leave a comment to join.',
        'Community',
        0,
        'community',
      ],
      [
        'notice',
        'Water tank cleaning · Sunday',
        'Water will be paused from 10 AM to 12 PM for scheduled maintenance.',
        'Maintenance',
        0,
        'community',
      ],
    ];
    return {
      'items': <Map<String, dynamic>>[
        for (var i = 0; i < samples.length; i++)
          {
            'id': 'sample-$i',
            'kind': samples[i][0],
            'title': samples[i][1],
            'description': samples[i][2],
            'category': samples[i][3],
            'price': samples[i][4],
            'image_asset': samples[i][5],
            'author_id': 'sample-neighbour',
            'author': i.isEven ? 'Priya Menon' : 'Neha Kapoor',
            'community': 'Palm Meadows',
            'unit': 'A-1204',
            'status': 'published',
            'saved': false,
            'bedrooms': i == 0 ? 3 : 2,
            'listing_type': i == 0 ? 'rent' : 'sell',
            'created_at': DateTime.now().toUtc().toIso8601String(),
            'comments': [],
            'comment_count': 0,
          },
      ],
      'requests': [],
      'inquiries': [],
    };
  }
}
