import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../domain/models.dart';
import '../../state/app_state.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key, required this.role});
  final AppRole role;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(appProvider);
    final rows = role == AppRole.guard
        ? state.entries
              .map(
                (e) => AppNotification(
                  id: e.id,
                  title: '${e.name} · ${e.status.label}',
                  body: '${e.description} · ${e.unit}',
                  createdAt:
                      e.exitedAt ??
                      e.enteredAt ??
                      e.deniedAt ??
                      e.approvedAt ??
                      e.createdAt,
                  entryId: e.id,
                  read: true,
                ),
              )
              .toList()
        : List<AppNotification>.of(state.notifications);
    rows.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return AppPage(
      maxWidth: 800,
      children: [
        const PageHeading(
          'Your updates',
          'Every arrival and decision, all in one place.',
        ),
        if (role == AppRole.resident && state.unread > 0)
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              onPressed: () async {
                try {
                  await ref.read(appProvider.notifier).markAllRead();
                } catch (e) {
                  if (context.mounted) showToast(context, friendlyError(e));
                }
              },
              child: const Text('Mark all as read'),
            ),
          ),
        if (rows.isEmpty)
          const Surface(
            child: EmptyState(
              title: 'All caught up',
              message: 'New visitor updates will appear here.',
            ),
          ),
        for (final n in rows)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: InkWell(
              onTap: n.entryId == null
                  ? null
                  : () => context.push('/visitor/${n.entryId}'),
              child: Surface(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    CircleAvatar(
                      backgroundColor: n.read
                          ? AppColors.canvas
                          : AppColors.peach,
                      child: const Icon(
                        Icons.notifications_none,
                        color: AppColors.coral,
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            n.title,
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: n.read
                                  ? FontWeight.w600
                                  : FontWeight.w800,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            n.body,
                            style: const TextStyle(
                              color: AppColors.muted,
                              fontSize: 12,
                              height: 1.6,
                            ),
                          ),
                          const SizedBox(height: 10),
                          Text(
                            DateFormat(
                              'd MMM · h:mm a',
                            ).format(n.createdAt.toLocal()),
                            style: const TextStyle(
                              color: AppColors.muted,
                              fontSize: 10,
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (!n.read)
                      const Padding(
                        padding: EdgeInsets.only(top: 7),
                        child: Badge(backgroundColor: AppColors.coral),
                      ),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}
