import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../services/content_repository.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import '../catalog/catalog_widgets.dart';

class ActivityScreen extends ConsumerStatefulWidget {
  const ActivityScreen({super.key});
  @override
  ConsumerState<ActivityScreen> createState() => _ActivityScreenState();
}

class _ActivityScreenState extends ConsumerState<ActivityScreen> {
  List<dynamic> rows = [];
  int requestVersion = 0;
  String tab = 'requests';
  String? error;
  bool loading = true;
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    final version = ++requestVersion;
    setState(() => loading = true);
    try {
      final result = await ref.read(contentRepositoryProvider).activity(tab);
      if (mounted && version == requestVersion) {
        setState(() {
          rows = result;
          error = null;
          loading = false;
        });
      }
    } catch (e) {
      if (mounted && version == requestVersion) {
        setState(() {
          error = friendlyError(e);
          loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) => AppPage(
    maxWidth: 800,
    children: [
      TextButton.icon(
        onPressed: () => context.canPop() ? context.pop() : context.go('/'),
        icon: const Icon(Icons.arrow_back),
        label: const Text('Back'),
      ),
      const PageHeading(
        'Your activity',
        'Service requests, listing enquiries and replies.',
      ),
      SegmentedButton<String>(
        segments: const [
          ButtonSegment(value: 'requests', label: Text('Requests')),
          ButtonSegment(value: 'inquiries', label: Text('Enquiries')),
        ],
        selected: {tab},
        onSelectionChanged: (v) {
          setState(() => tab = v.first);
          load();
        },
      ),
      const SizedBox(height: 22),
      if (loading)
        const Center(child: CircularProgressIndicator())
      else if (error != null)
        EmptyState(
          title: 'Couldn’t load activity',
          message: error!,
          action: TextButton(onPressed: load, child: const Text('Retry')),
        )
      else if (rows.isEmpty)
        const Surface(
          child: EmptyState(
            title: 'Nothing here yet',
            message:
                'Your service requests and listing conversations will appear here.',
          ),
        )
      else
        for (final row in rows)
          Padding(
            padding: const EdgeInsets.only(bottom: 14),
            child: Surface(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    row['title'],
                    style: const TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 9),
                  if (tab == 'requests') ...[
                    Text(
                      '${row['unit']} · ${row['scheduled_on'].toString().substring(0, 10)}',
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Status: ${row['status']}',
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    if (['requested', 'accepted'].contains(row['status']))
                      TextButton(
                        onPressed: () async {
                          try {
                            await ref
                                .read(contentRepositoryProvider)
                                .cancel(row['id']);
                            await load();
                          } catch (e) {
                            if (context.mounted) {
                              showToast(context, friendlyError(e));
                            }
                          }
                        },
                        child: const Text('Cancel request'),
                      ),
                  ] else ...[
                    Text(
                      '${row['sender']} → ${row['recipient']}',
                      style: const TextStyle(color: AppColors.muted),
                    ),
                    const SizedBox(height: 9),
                    Text(row['message']),
                    if (row['reply'] != null) ...[
                      const Divider(height: 25),
                      Text('Reply: ${row['reply']}'),
                    ],
                    if (row['recipient_id'] ==
                        ref.read(contentRepositoryProvider).userId)
                      TextButton(
                        onPressed: () async {
                          final text = await askMessage(
                            context,
                            'Reply to enquiry',
                          );
                          if (text == null) return;
                          try {
                            await ref
                                .read(contentRepositoryProvider)
                                .reply(row['id'], text);
                            await load();
                          } catch (e) {
                            if (context.mounted) {
                              showToast(context, friendlyError(e));
                            }
                          }
                        },
                        child: const Text('Reply'),
                      ),
                  ],
                ],
              ),
            ),
          ),
    ],
  );
}
