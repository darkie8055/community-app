import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../services/content_repository.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';

class CommunityPosts extends ConsumerStatefulWidget {
  const CommunityPosts({super.key});
  @override
  ConsumerState<CommunityPosts> createState() => _CommunityPostsState();
}

class _CommunityPostsState extends ConsumerState<CommunityPosts> {
  List<dynamic> posts = [];
  String? error;
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final data = await ref.read(contentRepositoryProvider).list('post');
      if (mounted) {
        setState(() {
          posts = data['items'];
          error = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() => error = friendlyError(e));
    }
  }

  @override
  Widget build(BuildContext context) => Column(
    children: [
      SectionTitle(
        'Community Posts',
        action: 'New Post',
        onTap: () async {
          await context.push('/new-item/post');
          if (mounted) load();
        },
      ),
      const SizedBox(height: 14),
      if (error != null)
        TextButton(
          onPressed: load,
          child: const Text('Reload community posts'),
        ),
      for (final p in posts.take(5))
        Padding(
          padding: const EdgeInsets.only(bottom: 16),
          child: Surface(
            radius: 24,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    CircleAvatar(
                      backgroundColor: const Color(0xFF8AA76D),
                      child: Text(
                        (p['author'] as String)[0],
                        style: const TextStyle(color: Colors.white),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            p['author'],
                            style: const TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 16,
                            ),
                          ),
                          Text(
                            p['community'],
                            style: const TextStyle(
                              color: AppColors.muted,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Icon(Icons.lock_outline, size: 14),
                  ],
                ),
                const SizedBox(height: 18),
                Text(
                  p['description'],
                  style: const TextStyle(fontSize: 14, height: 1.55),
                ),
                const SizedBox(height: 16),
                OutlinedButton(
                  onPressed: () async {
                    await context.push('/item/${p['id']}');
                    if (mounted) load();
                  },
                  child: Row(
                    children: [
                      const Expanded(
                        child: Text(
                          'Add your thoughts…',
                          style: TextStyle(color: AppColors.muted),
                        ),
                      ),
                      const Icon(Icons.send_outlined, size: 19),
                    ],
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  '${p['comment_count'] ?? 0} comments',
                  style: const TextStyle(color: AppColors.muted, fontSize: 11),
                ),
              ],
            ),
          ),
        ),
    ],
  );
}
