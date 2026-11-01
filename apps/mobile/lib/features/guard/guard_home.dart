import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../domain/models.dart';
import '../../state/app_state.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';

class GuardHome extends ConsumerWidget {
  const GuardHome({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final entries = ref.watch(appProvider).entries;
    final waiting = entries
        .where(
          (v) =>
              v.status == VisitStatus.pending ||
              v.status == VisitStatus.approved,
        )
        .toList();
    final inside = entries
        .where((v) => v.status == VisitStatus.inside)
        .toList();
    final today = DateTime.now();
    final todayEntries = entries.where((v) {
      final d = v.createdAt.toLocal();
      return d.year == today.year &&
          d.month == today.month &&
          d.day == today.day;
    }).length;
    return AppPage(
      children: [
        const PageHeading(
          'A safe community starts here.',
          'Welcome, Rajesh. You’re on duty at Main Gate.',
        ),
        Container(
          padding: const EdgeInsets.all(26),
          decoration: BoxDecoration(
            color: const Color(0xFF304D40),
            borderRadius: BorderRadius.circular(18),
          ),
          child: Row(
            children: [
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'MAIN GATE',
                      style: TextStyle(
                        color: Color(0xFFB6CFBE),
                        fontSize: 9,
                        letterSpacing: 1.6,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    SizedBox(height: 12),
                    Text(
                      'Every welcome,\nmade a little safer.',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 24,
                        height: 1.3,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -.7,
                      ),
                    ),
                    SizedBox(height: 10),
                    Text(
                      'Register. Verify. Welcome.',
                      style: TextStyle(color: Color(0xFFB6CFBE), fontSize: 11),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              FilledButton.icon(
                key: const Key('new-visitor'),
                onPressed: () => context.push('/new-visitor'),
                icon: const Icon(Icons.add_rounded, size: 19),
                label: const Text(
                  'New visitor',
                  style: TextStyle(fontSize: 11),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 22),
        OutlinedButton.icon(
          key: const Key('scan-pass'),
          onPressed: () => context.push('/verify-pass'),
          icon: const Icon(Icons.qr_code_scanner),
          label: const Text('Scan QR / verify visitor code'),
        ),
        const SizedBox(height: 22),
        Row(
          children: [
            Expanded(
              child: _stat(
                'Visitors today',
                '$todayEntries',
                Icons.people_outline_rounded,
                AppColors.coral,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _stat(
                'Inside now',
                '${inside.length}',
                Icons.login_rounded,
                AppColors.green,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _stat(
                'At the gate',
                '${waiting.length}',
                Icons.door_front_door_outlined,
                const Color(0xFFAE8F51),
              ),
            ),
          ],
        ),
        const SizedBox(height: 25),
        Surface(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SectionTitle(
                'At the gate',
                count: waiting.length,
                action: 'All visitors',
                onTap: () => context.go('/visitors'),
              ),
              const SizedBox(height: 12),
              if (waiting.isEmpty)
                const EmptyState(
                  title: 'The gate is clear',
                  message:
                      'New requests will appear here as you register visitors.',
                ),
              for (final v in waiting) ...[
                VisitorTile(
                  v,
                  showUnit: true,
                  onTap: () => context.push('/visitor/${v.id}'),
                ),
                if (v.status == VisitStatus.approved)
                  Padding(
                    padding: const EdgeInsets.only(left: 60, bottom: 16),
                    child: FilledButton.icon(
                      onPressed: () =>
                          _transition(context, ref, v, VisitStatus.inside),
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.green,
                      ),
                      icon: const Icon(Icons.login_rounded, size: 17),
                      label: const Text('Record entry'),
                    ),
                  ),
                const Divider(),
              ],
            ],
          ),
        ),
        const SizedBox(height: 22),
        Surface(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SectionTitle('Currently inside', count: inside.length),
              const SizedBox(height: 8),
              if (inside.isEmpty)
                const EmptyState(
                  title: 'No visitors inside',
                  message: 'Checked-in visitors will appear here.',
                ),
              for (final v in inside) ...[
                VisitorTile(
                  v,
                  showUnit: true,
                  onTap: () => context.push('/visitor/${v.id}'),
                  action: OutlinedButton(
                    onPressed: () =>
                        _transition(context, ref, v, VisitStatus.exited),
                    child: const Text(
                      'Check out',
                      style: TextStyle(fontSize: 11),
                    ),
                  ),
                ),
                const Divider(),
              ],
            ],
          ),
        ),
        const SizedBox(height: 20),
        const Row(
          children: [
            Icon(Icons.info_outline_rounded, size: 15, color: AppColors.muted),
            SizedBox(width: 8),
            Expanded(
              child: Text(
                'Only approved visitors can be checked in. Every entry and exit is recorded.',
                style: TextStyle(
                  fontSize: 10,
                  color: AppColors.muted,
                  height: 1.7,
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _stat(String title, String value, IconData icon, Color color) =>
      Surface(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: color, size: 21),
            const SizedBox(height: 15),
            Text(
              value.padLeft(2, '0'),
              style: const TextStyle(fontSize: 25, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 5),
            Text(
              title,
              style: const TextStyle(fontSize: 10, color: AppColors.muted),
            ),
          ],
        ),
      );
  Future<void> _transition(
    BuildContext context,
    WidgetRef ref,
    VisitorEntry v,
    VisitStatus next,
  ) async {
    try {
      await ref
          .read(appProvider.notifier)
          .changeStatus(v.id, next, AppRole.guard);
      if (context.mounted) {
        showToast(
          context,
          '${v.name}: ${next == VisitStatus.inside ? 'entry' : 'exit'} recorded.',
        );
      }
    } catch (e) {
      if (context.mounted) showToast(context, friendlyError(e));
    }
  }
}
