import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../domain/models.dart';
import '../../state/app_state.dart';
import '../../ui/neighbourhood_art.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import '../community/community_posts.dart';

class ResidentHome extends ConsumerWidget {
  const ResidentHome({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final visits = ref.watch(appProvider).residentEntries;
    final waiting = visits
        .where((v) => v.status == VisitStatus.pending)
        .toList();
    return AppPage(
      children: [
        if (MediaQuery.sizeOf(context).width >= 700)
          PageHeading(
            'Welcome home, ${ref.read(backendProvider)?.userName.split(' ').first ?? 'Aarav'}',
            'Your home. Your people. Everything in one place.',
          ),
        LayoutBuilder(
          builder: (context, constraints) {
            final wide = constraints.maxWidth >= 760;
            final main = Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _welcomeBanner(context),
                const SizedBox(height: 23),
                _quickActions(context),
                const SizedBox(height: 23),
                if (!wide && waiting.isNotEmpty) ...[
                  _approval(context, ref, waiting.first),
                  const SizedBox(height: 23),
                ],
                _visitors(context, visits),
                const SizedBox(height: 23),
                _neighbourhood(context),
                const SizedBox(height: 23),
                const CommunityPosts(),
              ],
            );
            final side = Column(
              children: [
                if (waiting.isNotEmpty)
                  _approval(context, ref, waiting.first)
                else
                  _allClear(context),
                const SizedBox(height: 22),
                _homeCard(context, ref),
                const SizedBox(height: 22),
                _notice(context),
              ],
            );
            if (wide) {
              return Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(flex: 20, child: main),
                  const SizedBox(width: 24),
                  Expanded(flex: 11, child: side),
                ],
              );
            }
            return Column(
              children: [
                main,
                const SizedBox(height: 23),
                _notice(context),
                const SizedBox(height: 23),
                _homeCard(context, ref),
              ],
            );
          },
        ),
        const SizedBox(height: 28),
        const Center(
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.favorite_outline_rounded,
                size: 12,
                color: AppColors.muted,
              ),
              SizedBox(width: 6),
              Text(
                'Made for a little more togetherness.',
                style: TextStyle(fontSize: 10, color: AppColors.muted),
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
      ],
    );
  }

  Widget _welcomeBanner(BuildContext context) => Container(
    height: 207,
    clipBehavior: Clip.antiAlias,
    decoration: BoxDecoration(
      gradient: const LinearGradient(
        colors: [Color(0xFF08785F), Color(0xFF20A987)],
      ),
      borderRadius: BorderRadius.circular(18),
    ),
    child: LayoutBuilder(
      builder: (context, constraints) => Stack(
        children: [
          Positioned(
            right: -25,
            bottom: -3,
            width: constraints.maxWidth * .56,
            height: 199,
            child: const NeighbourhoodArt(),
          ),
          Positioned(
            left: 25,
            top: 24,
            right: constraints.maxWidth * .38,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'LIFE’S BETTER, TOGETHER',
                  style: TextStyle(
                    fontSize: 8,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.5,
                    color: Color(0xFFCAF0DD),
                  ),
                ),
                const SizedBox(height: 10),
                const Text(
                  'A happier place\nto call home.',
                  style: TextStyle(
                    fontSize: 27,
                    fontWeight: FontWeight.w800,
                    height: 1.23,
                    letterSpacing: -1.2,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 16),
                SizedBox(
                  height: 33,
                  child: FilledButton(
                    onPressed: () => context.push('/invite'),
                    style: FilledButton.styleFrom(
                      minimumSize: Size.zero,
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      backgroundColor: AppColors.yellow,
                      foregroundColor: AppColors.ink,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(7),
                      ),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text('Invite a guest', style: TextStyle(fontSize: 10)),
                        SizedBox(width: 8),
                        Icon(Icons.arrow_forward_rounded, size: 13),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );

  Widget _quickActions(BuildContext context) {
    final actions = [
      (
        'Pre-approve',
        Icons.person_add_alt_1_outlined,
        const Color(0xFFE0795D),
        '/invite',
      ),
      (
        'My visitors',
        Icons.people_outline_rounded,
        const Color(0xFF8393B8),
        '/visitors',
      ),
      (
        'Notice board',
        Icons.assignment_outlined,
        const Color(0xFFBD955E),
        '/community',
      ),
      (
        'Security',
        Icons.shield_outlined,
        const Color(0xFF6F9C84),
        '/community',
      ),
      ('My home', Icons.cottage_outlined, const Color(0xFFBD8A74), '/profile'),
      (
        'Directory',
        Icons.contact_phone_outlined,
        const Color(0xFF9690BA),
        '/community',
      ),
      (
        'Updates',
        Icons.notifications_none_rounded,
        const Color(0xFF78A5A6),
        '/notifications',
      ),
      (
        'View all',
        Icons.grid_view_rounded,
        const Color(0xFF8B9088),
        '/community',
      ),
    ];
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 2),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionTitle('Quick actions'),
          const SizedBox(height: 20),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: actions.length,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 4,
              mainAxisSpacing: 20,
              crossAxisSpacing: 6,
              mainAxisExtent: 100,
            ),
            itemBuilder: (context, i) {
              final a = actions[i];
              return InkWell(
                borderRadius: BorderRadius.circular(12),
                onTap: () => context.push(a.$4),
                child: Column(
                  children: [
                    Container(
                      width: 57,
                      height: 57,
                      decoration: BoxDecoration(
                        color: i == 7 ? AppColors.yellow : Colors.white,
                        borderRadius: BorderRadius.circular(18),
                      ),
                      child: Icon(
                        i == 7 ? Icons.add : a.$2,
                        color: AppColors.coral,
                        size: 29,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      a.$1,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _visitors(BuildContext context, List<VisitorEntry> visits) => Surface(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionTitle(
          'Visitor updates',
          action: 'View all',
          onTap: () => context.go('/visitors'),
        ),
        const SizedBox(height: 2),
        const Text(
          'A little peace of mind, in real time.',
          style: TextStyle(fontSize: 10, color: AppColors.muted),
        ),
        const SizedBox(height: 12),
        for (final entry in visits.take(3)) ...[
          VisitorTile(entry, onTap: () => context.push('/visitor/${entry.id}')),
          if (entry != visits.take(3).last) const Divider(),
        ],
        if (visits.isEmpty)
          const EmptyState(
            title: 'No visitors yet',
            message: 'Your visitor activity will appear here.',
          ),
      ],
    ),
  );

  Widget _approval(
    BuildContext context,
    WidgetRef ref,
    VisitorEntry entry,
  ) => Surface(
    color: const Color(0xFFFFFCF7),
    borderColor: const Color(0xFFF0DEC8),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              width: 7,
              height: 7,
              decoration: const BoxDecoration(
                color: Color(0xFFD39B50),
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 7),
            const Text(
              'AT YOUR GATE',
              style: TextStyle(
                fontSize: 8,
                letterSpacing: 1.4,
                fontWeight: FontWeight.w800,
                color: Color(0xFFAD7D3E),
              ),
            ),
            const Spacer(),
            const Icon(
              Icons.doorbell_outlined,
              size: 19,
              color: Color(0xFFAD7D3E),
            ),
          ],
        ),
        const SizedBox(height: 16),
        const Text(
          'Someone’s here for you',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w800,
            letterSpacing: -.4,
          ),
        ),
        const SizedBox(height: 18),
        InkWell(
          onTap: () => context.push('/visitor/${entry.id}'),
          child: Row(
            children: [
              VisitorAvatar(entry, size: 49),
              const SizedBox(width: 11),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      entry.name,
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 12,
                      ),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      entry.description,
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontSize: 10,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(
                Icons.chevron_right_rounded,
                size: 18,
                color: AppColors.muted,
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        const Row(
          children: [
            Icon(Icons.location_on_outlined, size: 12, color: AppColors.muted),
            SizedBox(width: 5),
            Text(
              'Main Gate · Waiting for your approval',
              style: TextStyle(fontSize: 9, color: AppColors.muted),
            ),
          ],
        ),
        const SizedBox(height: 18),
        Row(
          children: [
            Expanded(
              child: SizedBox(
                height: 39,
                child: OutlinedButton(
                  key: const Key('home-deny'),
                  onPressed: () =>
                      _decide(context, ref, entry, VisitStatus.denied),
                  style: OutlinedButton.styleFrom(
                    minimumSize: Size.zero,
                    padding: EdgeInsets.zero,
                    side: const BorderSide(color: Color(0xFFE5DCD2)),
                  ),
                  child: const Text(
                    'Deny',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              flex: 2,
              child: SizedBox(
                height: 39,
                child: FilledButton(
                  key: const Key('home-approve'),
                  onPressed: () =>
                      _decide(context, ref, entry, VisitStatus.approved),
                  style: FilledButton.styleFrom(
                    minimumSize: Size.zero,
                    padding: EdgeInsets.zero,
                  ),
                  child: const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.check_rounded, size: 16),
                      SizedBox(width: 5),
                      Text('Approve entry', style: TextStyle(fontSize: 11)),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ],
    ),
  );

  Future<void> _decide(
    BuildContext context,
    WidgetRef ref,
    VisitorEntry entry,
    VisitStatus status,
  ) async {
    if (status == VisitStatus.denied) {
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Deny this visitor?'),
          content: Text('Security will be told not to let ${entry.name} in.'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Go back'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Deny entry'),
            ),
          ],
        ),
      );
      if (confirmed != true) return;
    }
    try {
      await ref
          .read(appProvider.notifier)
          .changeStatus(entry.id, status, AppRole.resident);
      if (context.mounted) {
        showToast(
          context,
          status == VisitStatus.approved
              ? '${entry.name} approved. Security can now record entry.'
              : 'Entry denied. Security has been updated.',
        );
      }
    } catch (e) {
      if (context.mounted) showToast(context, friendlyError(e));
    }
  }

  Widget _allClear(BuildContext context) => const Surface(
    color: Color(0xFFF0F6EF),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(Icons.verified_user_outlined, color: AppColors.green, size: 28),
        SizedBox(height: 15),
        Text(
          'You’re all caught up',
          style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
        ),
        SizedBox(height: 8),
        Text(
          'No approvals waiting. Enjoy a little peace and quiet.',
          style: TextStyle(fontSize: 11, height: 1.8, color: AppColors.muted),
        ),
      ],
    ),
  );

  Widget _homeCard(BuildContext context, WidgetRef ref) => Surface(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Row(
          children: [
            Icon(Icons.cottage_outlined, size: 18, color: AppColors.muted),
            SizedBox(width: 8),
            Text(
              'MY HOME',
              style: TextStyle(
                fontSize: 8,
                letterSpacing: 1.4,
                fontWeight: FontWeight.w800,
                color: AppColors.muted,
              ),
            ),
          ],
        ),
        const SizedBox(height: 17),
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              ref.read(backendProvider)?.ownUnits.keys.firstOrNull ?? 'A-1204',
              style: TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.w800,
                letterSpacing: -1,
              ),
            ),
            Spacer(),
            Icon(Icons.apartment_rounded, size: 41, color: Color(0xFFCFD8C8)),
          ],
        ),
        const SizedBox(height: 5),
        Text(
          ref.read(backendProvider)?.communityName ?? 'Palm Meadows · Tower A',
          style: TextStyle(fontSize: 10, color: AppColors.muted),
        ),
        const SizedBox(height: 20),
        const Divider(),
        const SizedBox(height: 15),
        Row(
          children: [
            Container(
              width: 24,
              height: 24,
              alignment: Alignment.center,
              decoration: const BoxDecoration(
                color: AppColors.peach,
                shape: BoxShape.circle,
              ),
              child: const Text(
                'AS',
                style: TextStyle(
                  fontSize: 7,
                  color: AppColors.coral,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            const SizedBox(width: 8),
            Text(
              ref.read(backendProvider)?.userName ?? 'Aarav Sharma',
              style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600),
            ),
            const Spacer(),
            InkWell(
              onTap: () => context.go('/profile'),
              child: const Text(
                'Manage',
                style: TextStyle(
                  fontSize: 10,
                  color: AppColors.coral,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ],
        ),
      ],
    ),
  );

  Widget _notice(BuildContext context) => Surface(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionTitle(
          'On the notice board',
          action: 'All',
          onTap: () => context.go('/community'),
        ),
        const SizedBox(height: 13),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
          decoration: BoxDecoration(
            color: const Color(0xFFEFF3F9),
            borderRadius: BorderRadius.circular(5),
          ),
          child: const Text(
            'MAINTENANCE',
            style: TextStyle(
              fontSize: 7,
              letterSpacing: .8,
              color: Color(0xFF7888A7),
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
        const SizedBox(height: 13),
        const Text(
          'Water tank cleaning',
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 8),
        const Text(
          'A quick heads-up: water supply in Tower A will pause this Sunday, 10 AM–12 PM.',
          style: TextStyle(fontSize: 11, height: 1.8, color: AppColors.muted),
        ),
        const SizedBox(height: 16),
        const Row(
          children: [
            CircleAvatar(
              radius: 12,
              backgroundColor: Color(0xFFF1F3EE),
              child: Icon(
                Icons.apartment_rounded,
                size: 13,
                color: AppColors.green,
              ),
            ),
            SizedBox(width: 7),
            Expanded(
              child: Text(
                'Management committee',
                style: TextStyle(fontSize: 8, color: AppColors.muted),
              ),
            ),
            Text(
              '2h ago',
              style: TextStyle(fontSize: 8, color: AppColors.muted),
            ),
          ],
        ),
      ],
    ),
  );

  Widget _neighbourhood(BuildContext context) => Container(
    clipBehavior: Clip.antiAlias,
    decoration: BoxDecoration(
      color: Colors.white,
      border: Border.all(color: AppColors.line),
      borderRadius: BorderRadius.circular(18),
    ),
    child: Row(
      children: [
        Expanded(
          flex: 3,
          child: Padding(
            padding: const EdgeInsets.all(22),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'AROUND YOUR COMMUNITY',
                  style: TextStyle(
                    fontSize: 7,
                    fontWeight: FontWeight.w800,
                    color: AppColors.green,
                    letterSpacing: 1.3,
                  ),
                ),
                const SizedBox(height: 10),
                const Text(
                  'Good neighbours.\nGreat beginnings.',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    height: 1.4,
                    letterSpacing: -.6,
                  ),
                ),
                const SizedBox(height: 13),
                InkWell(
                  onTap: () => context.go('/community'),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        'Explore your community',
                        style: TextStyle(
                          fontSize: 10,
                          color: AppColors.coral,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      SizedBox(width: 6),
                      Icon(
                        Icons.arrow_forward_rounded,
                        size: 13,
                        color: AppColors.coral,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        Expanded(
          flex: 2,
          child: Image.asset(
            'assets/images/community.jpg',
            height: 172,
            fit: BoxFit.cover,
          ),
        ),
      ],
    ),
  );
}
