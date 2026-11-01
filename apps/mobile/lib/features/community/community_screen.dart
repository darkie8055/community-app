import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../domain/models.dart';
import '../../state/app_state.dart';
import '../../services/content_repository.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import 'community_posts.dart';
import '../catalog/catalog_widgets.dart';

class CommunityScreen extends ConsumerStatefulWidget {
  const CommunityScreen({super.key, required this.role});
  final AppRole role;
  @override
  ConsumerState<CommunityScreen> createState() => _CommunityScreenState();
}

class _CommunityScreenState extends ConsumerState<CommunityScreen> {
  List<dynamic> people = [], notices = [];
  Map<String, dynamic> stats = {};
  String? error;
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final backend = ref.read(backendProvider);
      final content = await ref.read(contentRepositoryProvider).list('notice');
      Map<String, dynamic> directory;
      if (backend != null) {
        directory = (await backend.dio.get<Map<String, dynamic>>(
          '/v1/communities/${backend.communityId}/directory',
        )).data!;
      } else {
        directory = {
          'stats': {'homes': 40, 'blocks': 4, 'residents': 2},
          'people': [
            {'name': 'Aarav Sharma', 'role': 'owner', 'unit': 'A-1204'},
            {'name': 'Priya Menon', 'role': 'admin'},
            {'name': 'Rajesh Kumar', 'role': 'guard'},
          ],
        };
      }
      if (mounted) {
        setState(() {
          notices = content['items'];
          people = directory['people'];
          stats = directory['stats'];
          error = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() => error = friendlyError(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final name = ref.read(backendProvider)?.communityName ?? 'Palm Meadows';
    final actions = [
      ('Pre-Approve', Icons.person_add_alt_1_outlined, '/invite'),
      ('Visitors', Icons.people_outline, '/visitors'),
      ('Services', Icons.handyman_outlined, '/stores'),
      ('Notice Board', Icons.assignment_outlined, '/notices'),
      ('My Home', Icons.home_outlined, '/profile'),
      ('Buy & Sell', Icons.handshake_outlined, '/marketplace'),
      ('Homes', Icons.home_work_outlined, '/homes'),
      ('My Requests', Icons.receipt_long_outlined, '/activity'),
      ('Updates', Icons.notifications_none, '/notifications'),
      ('Membership', Icons.add, '/join'),
    ];
    return RefreshIndicator(
      onRefresh: load,
      child: AppPage(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(20),
            child: Stack(
              children: [
                const ItemPhoto({'image_asset': 'house'}, height: 190),
                Positioned.fill(
                  child: Container(
                    decoration: const BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [Colors.transparent, Color(0xBB123E34)],
                      ),
                    ),
                  ),
                ),
                Positioned(
                  left: 22,
                  bottom: 23,
                  right: 22,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'A LITTLE MORE CONNECTED',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 9,
                          letterSpacing: 1.5,
                        ),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        name,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 27,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 22),
          Text(
            name,
            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 22),
          ),
          const SizedBox(height: 6),
          const Text(
            'Your neighbours. Your everyday.',
            style: TextStyle(color: AppColors.muted),
          ),
          const SizedBox(height: 22),
          Row(
            children: [
              for (final stat in [
                ('Homes', 'homes'),
                ('Blocks', 'blocks'),
                ('Residents', 'residents'),
              ])
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: Surface(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(stat.$1, style: const TextStyle(fontSize: 11)),
                          const SizedBox(height: 10),
                          Text(
                            '${stats[stat.$2] ?? '—'}',
                            style: const TextStyle(
                              fontSize: 23,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 28),
          const SectionTitle('Community Actions'),
          const SizedBox(height: 18),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: actions.length,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 5,
              mainAxisExtent: 99,
              crossAxisSpacing: 8,
              mainAxisSpacing: 10,
            ),
            itemBuilder: (context, i) => InkWell(
              onTap: () => context.push(actions[i].$3),
              child: Column(
                children: [
                  Container(
                    height: 52,
                    width: 52,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(17),
                    ),
                    child: Icon(actions[i].$2, size: 27),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    actions[i].$1,
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 10, height: 1.3),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 25),
          SectionTitle(
            'Notice Board',
            action: 'View all',
            onTap: () => context.push('/notices'),
          ),
          const SizedBox(height: 14),
          if (error != null)
            TextButton(onPressed: load, child: Text('Retry: $error')),
          for (final n in notices.take(2))
            Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: InkWell(
                onTap: () => context.push('/item/${n['id']}'),
                child: Surface(
                  radius: 23,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(
                            Icons.assignment_outlined,
                            color: AppColors.coral,
                          ),
                          const SizedBox(width: 10),
                          Text(
                            n['category'],
                            style: const TextStyle(
                              color: AppColors.coral,
                              fontWeight: FontWeight.w700,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Text(
                        n['title'],
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 7),
                      Text(
                        n['description'],
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: AppColors.muted,
                          height: 1.65,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          const SizedBox(height: 22),
          const SectionTitle('Connect with Neighbours'),
          const SizedBox(height: 6),
          const Text(
            'Residents who call your society home',
            style: TextStyle(color: AppColors.muted, fontSize: 12),
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              for (final p in people.where(
                (dynamic p) => !['admin', 'guard'].contains(p['role']),
              ))
                SizedBox(
                  width: MediaQuery.sizeOf(context).width < 700
                      ? (MediaQuery.sizeOf(context).width - 52) / 2
                      : 245,
                  child: Surface(
                    padding: const EdgeInsets.all(17),
                    child: Row(
                      children: [
                        CircleAvatar(
                          radius: 19,
                          backgroundColor: const Color(0xFF70959D),
                          child: Text(
                            (p['name'] as String)[0],
                            style: const TextStyle(color: Colors.white),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                p['name'],
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 12,
                                ),
                              ),
                              Text(
                                p['unit'] ?? '',
                                style: const TextStyle(
                                  color: AppColors.muted,
                                  fontSize: 11,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 30),
          const SectionTitle('Security & Society Directory'),
          const SizedBox(height: 15),
          Surface(
            child: Column(
              children: [
                for (final p in people.where(
                  (dynamic p) => ['admin', 'guard'].contains(p['role']),
                ))
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: CircleAvatar(
                      backgroundColor: AppColors.canvas,
                      child: Icon(
                        p['role'] == 'guard'
                            ? Icons.shield_outlined
                            : Icons.apartment_outlined,
                      ),
                    ),
                    title: Text(
                      p['name'],
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                      ),
                    ),
                    subtitle: Text(
                      '${p['role']}${p['phone'] != null ? ' · +91 ${p['phone']}' : ''}',
                      style: const TextStyle(fontSize: 11),
                    ),
                    trailing: const Icon(
                      Icons.verified_user_outlined,
                      size: 21,
                      color: AppColors.green,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 30),
          const CommunityPosts(),
          const SizedBox(height: 20),
        ],
      ),
    );
  }
}
