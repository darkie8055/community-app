import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../services/content_repository.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import 'package:intl/intl.dart';
import 'catalog_widgets.dart';

class ItemDetailScreen extends ConsumerStatefulWidget {
  const ItemDetailScreen({super.key, required this.id});
  final String id;
  @override
  ConsumerState<ItemDetailScreen> createState() => _ItemDetailScreenState();
}

class _ItemDetailScreenState extends ConsumerState<ItemDetailScreen> {
  Map<String, dynamic>? item;
  String? error;
  bool busy = false;
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final result = await ref
          .read(contentRepositoryProvider)
          .detail(widget.id);
      if (mounted) {
        setState(() {
          item = result;
          error = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() => error = friendlyError(e));
    }
  }

  Future<bool> act(String name, [Map<String, dynamic>? data]) async {
    setState(() => busy = true);
    try {
      await ref.read(contentRepositoryProvider).action(widget.id, name, data);
      await load();
      return true;
    } catch (e) {
      if (mounted) showToast(context, friendlyError(e));
      return false;
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> message(bool comment) async {
    final text = await askMessage(
      context,
      comment ? 'Add your comment' : 'Send an enquiry',
    );
    if (text == null || !mounted) return;
    final success = await act(comment ? 'comments' : 'inquiries', {
      'message': text,
    });
    if (mounted && !comment && success) {
      showToast(context, 'Enquiry sent. View replies in your activity.');
    }
  }

  Future<void> book() async {
    final repo = ref.read(contentRepositoryProvider);
    if (repo.homes.isEmpty) {
      showToast(context, 'An approved home membership is required.');
      return;
    }
    final date = await showDatePicker(
      context: context,
      initialDate: DateTime.now().add(const Duration(days: 1)),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 180)),
    );
    if (date == null || !mounted) return;
    final note = await askMessage(
      context,
      'Service requirements',
      hint: 'Tell the team what you need',
    );
    if (note == null || !mounted) return;
    final success = await act('requests', {
      'unit_id': repo.homes.values.first,
      'scheduled_on': DateFormat('yyyy-MM-dd').format(date),
      'note': note,
    });
    if (mounted && success) {
      showToast(
        context,
        'Request submitted. The society team will confirm availability.',
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final i = item;
    return AppPage(
      maxWidth: 820,
      children: [
        TextButton.icon(
          onPressed: () => context.canPop() ? context.pop() : context.go('/'),
          icon: const Icon(Icons.arrow_back),
          label: const Text('Back'),
        ),
        if (error != null)
          EmptyState(
            title: 'Unable to open item',
            message: error!,
            action: TextButton(onPressed: load, child: const Text('Retry')),
          )
        else if (i == null)
          const Center(child: CircularProgressIndicator())
        else ...[
          if (!['post', 'notice'].contains(i['kind']))
            ClipRRect(
              borderRadius: BorderRadius.circular(24),
              child: ItemPhoto(i, height: 285),
            ),
          const SizedBox(height: 20),
          Surface(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        i['title'],
                        style: const TextStyle(
                          fontSize: 25,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                    IconButton(
                      tooltip: 'Save item',
                      onPressed: busy ? null : () => act('bookmark'),
                      icon: Icon(
                        i['saved'] == true
                            ? Icons.bookmark
                            : Icons.bookmark_border,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                if (!['post', 'notice'].contains(i['kind']))
                  Text(
                    '${money(i['price'])}${i['listing_type'] == 'rent' ? ' / month' : ''}',
                    style: const TextStyle(
                      fontSize: 23,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                const SizedBox(height: 12),
                Text(
                  '${i['author']} · ${i['community']}',
                  style: const TextStyle(color: AppColors.muted),
                ),
                if (i['unit'] != null)
                  Text(
                    '${i['unit']}${i['bedrooms'] != null ? ' · ${i['bedrooms']} BHK' : ''}',
                    style: const TextStyle(color: AppColors.muted),
                  ),
                const SizedBox(height: 22),
                Text(
                  i['description'] ?? '',
                  style: const TextStyle(fontSize: 15, height: 1.8),
                ),
                const SizedBox(height: 22),
                if (i['author_id'] ==
                    ref.read(contentRepositoryProvider).userId)
                  Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: [
                      if (i['status'] != 'published')
                        FilledButton(
                          onPressed: busy
                              ? null
                              : () => act('status', {'status': 'published'}),
                          child: const Text('Publish listing'),
                        ),
                      if (i['status'] == 'published')
                        OutlinedButton(
                          onPressed: busy
                              ? null
                              : () => act('status', {'status': 'closed'}),
                          child: Text(
                            i['kind'] == 'post'
                                ? 'Close post'
                                : 'Mark unavailable',
                          ),
                        ),
                    ],
                  ),
                if (i['status'] == 'published' &&
                    (i['author_id'] !=
                            ref.read(contentRepositoryProvider).userId ||
                        ['post', 'notice'].contains(i['kind'])))
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: busy
                          ? null
                          : i['kind'] == 'service'
                          ? book
                          : () =>
                                message(['post', 'notice'].contains(i['kind'])),
                      icon: Icon(
                        i['kind'] == 'service'
                            ? Icons.calendar_month_outlined
                            : Icons.chat_bubble_outline,
                      ),
                      label: Text(
                        i['kind'] == 'service'
                            ? 'Request a service'
                            : ['post', 'notice'].contains(i['kind'])
                            ? 'Add a comment'
                            : 'Contact seller',
                      ),
                    ),
                  ),
                if (i['kind'] == 'service')
                  const Padding(
                    padding: EdgeInsets.only(top: 14),
                    child: Text(
                      'This is a booking request. Your society team confirms the date and final price. No payment is collected here.',
                      style: TextStyle(
                        color: AppColors.muted,
                        fontSize: 12,
                        height: 1.6,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          if (['post', 'notice'].contains(i['kind'])) ...[
            const SizedBox(height: 20),
            const SectionTitle('Conversation'),
            for (final c in (i['comments'] ?? []) as List)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Surface(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        c['author'],
                        style: const TextStyle(fontWeight: FontWeight.w800),
                      ),
                      const SizedBox(height: 8),
                      Text(c['body'], style: const TextStyle(height: 1.6)),
                    ],
                  ),
                ),
              ),
          ],
        ],
      ],
    );
  }
}
