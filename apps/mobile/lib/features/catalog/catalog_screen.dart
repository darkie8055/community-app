import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../services/content_repository.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import 'catalog_widgets.dart';

class ExploreScreen extends ConsumerStatefulWidget {
  const ExploreScreen({super.key, required this.kind});
  final String kind;
  @override
  ConsumerState<ExploreScreen> createState() => _ExploreScreenState();
}

class _ExploreScreenState extends ConsumerState<ExploreScreen> {
  List<Map<String, dynamic>> items = [];
  String query = '', category = '';
  String? cursor, error;
  bool loading = true, saved = false, mine = false;
  int generation = 0;
  Timer? debounce;
  String get title => widget.kind == 'property'
      ? 'Homes'
      : widget.kind == 'service'
      ? 'Services'
      : widget.kind == 'notice'
      ? 'Notice Board'
      : 'Buy & Sell';
  @override
  void initState() {
    super.initState();
    category = widget.kind == 'property' ? 'Rent' : '';
    load();
  }

  @override
  void didUpdateWidget(ExploreScreen old) {
    super.didUpdateWidget(old);
    if (old.kind != widget.kind) {
      query = '';
      category = widget.kind == 'property' ? 'Rent' : '';
      saved = false;
      mine = false;
      load();
    }
  }

  @override
  void dispose() {
    debounce?.cancel();
    super.dispose();
  }

  Future<void> load({bool more = false}) async {
    final version = ++generation;
    setState(() => loading = true);
    try {
      final data = await ref
          .read(contentRepositoryProvider)
          .list(
            widget.kind,
            search: query,
            category: category,
            saved: saved,
            mine: mine,
            cursor: more ? cursor : null,
          );
      if (!mounted || version != generation) return;
      setState(() {
        final next = (data['items'] as List)
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
        items = more ? [...items, ...next] : next;
        cursor = data['next_cursor'];
        error = null;
        loading = false;
      });
    } catch (e) {
      if (mounted && version == generation) {
        setState(() {
          error = friendlyError(e);
          loading = false;
        });
      }
    }
  }

  Future<void> newItem() async {
    await context.push('/new-item/${widget.kind}');
    if (mounted) load();
  }

  @override
  Widget build(BuildContext context) => Stack(
    children: [
      RefreshIndicator(
        onRefresh: load,
        child: AppPage(
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    title,
                    style: const TextStyle(
                      fontSize: 25,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                if (['property', 'listing'].contains(widget.kind))
                  IconButton(
                    tooltip: mine ? 'Show all listings' : 'My listings',
                    onPressed: () {
                      setState(() => mine = !mine);
                      load();
                    },
                    icon: Icon(mine ? Icons.sell : Icons.sell_outlined),
                  ),
                IconButton(
                  tooltip: saved ? 'Show all items' : 'Saved items',
                  onPressed: () {
                    setState(() => saved = !saved);
                    load();
                  },
                  icon: Icon(saved ? Icons.bookmark : Icons.bookmark_border),
                ),
                IconButton(
                  tooltip: 'Enquiries and requests',
                  onPressed: () => context.push('/activity'),
                  icon: const Icon(Icons.chat_bubble_outline),
                ),
              ],
            ),
            const SizedBox(height: 18),
            if (widget.kind == 'property' && !saved && !mine) ...[
              _propertyBanner(),
              const SizedBox(height: 20),
            ],
            if (widget.kind == 'service' && !saved && !mine) ...[
              _servicesBanner(),
              const SizedBox(height: 24),
            ],
            if (widget.kind == 'listing' && !saved && !mine) ...[
              InkWell(
                onTap: () => context.go('/homes'),
                child: Surface(
                  radius: 22,
                  child: Column(
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.home_work_outlined, size: 29),
                          const SizedBox(width: 14),
                          const Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Homes',
                                  style: TextStyle(
                                    fontSize: 20,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                                Text(
                                  'List · Buy · Rent',
                                  style: TextStyle(color: AppColors.muted),
                                ),
                              ],
                            ),
                          ),
                          const Text(
                            'Explore',
                            style: TextStyle(
                              color: AppColors.coral,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const Icon(Icons.chevron_right),
                        ],
                      ),
                      const SizedBox(height: 14),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(15),
                        child: const ItemPhoto({
                          'image_asset': 'house',
                        }, height: 105),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 20),
            ],
            if (saved || mine)
              Padding(
                padding: const EdgeInsets.only(bottom: 14),
                child: Text(
                  saved ? 'Your saved items' : 'Your listings and drafts',
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            if (widget.kind == 'property')
              Surface(
                child: Column(
                  children: [
                    Row(
                      children: [
                        for (final entry in ['Rent', 'Buy'])
                          Expanded(
                            child: TextButton(
                              onPressed: () {
                                setState(
                                  () =>
                                      category = category == entry ? '' : entry,
                                );
                                load();
                              },
                              child: Column(
                                children: [
                                  Text(
                                    entry,
                                    style: TextStyle(
                                      fontSize: 17,
                                      fontWeight: category == entry
                                          ? FontWeight.w800
                                          : FontWeight.w500,
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                  Container(
                                    height: 3,
                                    color: category == entry
                                        ? AppColors.yellow
                                        : Colors.transparent,
                                  ),
                                ],
                              ),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Find your next home in your community',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 15),
                    _search(),
                  ],
                ),
              )
            else
              _search(),
            const SizedBox(height: 22),
            if (widget.kind == 'listing')
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: categories.length,
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 4,
                  mainAxisExtent: 100,
                  crossAxisSpacing: 10,
                  mainAxisSpacing: 8,
                ),
                itemBuilder: (context, i) => InkWell(
                  onTap: () {
                    setState(
                      () => category = category == categories[i]
                          ? ''
                          : categories[i],
                    );
                    load();
                  },
                  child: Column(
                    children: [
                      Container(
                        width: 56,
                        height: 56,
                        decoration: BoxDecoration(
                          color: category == categories[i]
                              ? AppColors.yellow
                              : Colors.white,
                          borderRadius: BorderRadius.circular(18),
                        ),
                        child: Icon(categoryIcons[i], size: 29),
                      ),
                      const SizedBox(height: 7),
                      Text(
                        categories[i],
                        textAlign: TextAlign.center,
                        style: const TextStyle(fontSize: 11),
                      ),
                    ],
                  ),
                ),
              ),
            if (widget.kind == 'service')
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    for (final name in serviceCategories)
                      Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: ChoiceChip(
                          label: Text(name),
                          selected: category == name,
                          onSelected: (_) {
                            setState(
                              () => category = category == name ? '' : name,
                            );
                            load();
                          },
                        ),
                      ),
                  ],
                ),
              ),
            const SizedBox(height: 20),
            SectionTitle(
              category.isNotEmpty
                  ? category
                  : widget.kind == 'property'
                  ? 'From your society'
                  : widget.kind == 'service'
                  ? 'Services for your home'
                  : 'Recent listings',
              count: items.length,
            ),
            const SizedBox(height: 16),
            if (error != null)
              Surface(
                child: EmptyState(
                  title: 'Couldn’t load this page',
                  message: error!,
                  action: TextButton(
                    onPressed: load,
                    child: const Text('Try again'),
                  ),
                ),
              )
            else if (loading && items.isEmpty)
              const Padding(
                padding: EdgeInsets.all(35),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (items.isEmpty)
              const Surface(
                child: EmptyState(
                  title: 'A fresh start',
                  message:
                      'No items match these filters. Try another search or add a listing.',
                ),
              )
            else
              LayoutBuilder(
                builder: (context, c) => GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: items.length,
                  gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: c.maxWidth > 800
                        ? 4
                        : c.maxWidth > 560
                        ? 3
                        : 2,
                    mainAxisExtent: c.maxWidth < 400 ? 242 : 278,
                    crossAxisSpacing: 12,
                    mainAxisSpacing: 16,
                  ),
                  itemBuilder: (context, i) =>
                      _item(items[i], c.maxWidth < 400 ? 150 : 182),
                ),
              ),
            if (cursor != null)
              Center(
                child: TextButton(
                  onPressed: loading ? null : () => load(more: true),
                  child: const Text('Load more'),
                ),
              ),
            if (widget.kind == 'service') ...[
              const SizedBox(height: 28),
              const Surface(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'A little help, close to home.',
                      style: TextStyle(
                        fontSize: 21,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    SizedBox(height: 12),
                    Text(
                      'Choose a service and a date. Your society team will review the request and confirm availability. Payment is arranged directly with the provider.',
                      style: TextStyle(height: 1.7, color: AppColors.muted),
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 95),
          ],
        ),
      ),
      if (widget.kind == 'property' || widget.kind == 'listing')
        Positioned(
          right: 20,
          bottom: 22,
          child: FloatingActionButton.extended(
            backgroundColor: AppColors.yellow,
            foregroundColor: AppColors.ink,
            onPressed: newItem,
            icon: const Icon(Icons.add, size: 27),
            label: Text(
              widget.kind == 'property' ? 'Post Property' : 'New Listing',
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
          ),
        ),
    ],
  );
  Widget _search() => TextField(
    onChanged: (v) {
      query = v;
      debounce?.cancel();
      debounce = Timer(const Duration(milliseconds: 300), load);
    },
    decoration: InputDecoration(
      hintText: widget.kind == 'property'
          ? 'Search by home, features or description'
          : 'What are you looking for?',
      prefixIcon: const Icon(Icons.search),
      fillColor: const Color(0xFFF9FAFB),
    ),
  );
  Widget _item(Map<String, dynamic> item, double photoHeight) => InkWell(
    borderRadius: BorderRadius.circular(20),
    onTap: () async {
      await context.push('/item/${item['id']}');
      if (mounted) load();
    },
    child: Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Stack(
            children: [
              ItemPhoto(item, height: photoHeight),
              Positioned(
                left: 10,
                bottom: 10,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 11,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: item['price'] == 0
                        ? const Color(0xFF27AB48)
                        : const Color(0xDD282D2B),
                    borderRadius: BorderRadius.circular(22),
                  ),
                  child: Text(
                    money(item['price']),
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                      fontSize: 12,
                    ),
                  ),
                ),
              ),
              if (item['saved'] == true)
                const Positioned(
                  top: 9,
                  right: 9,
                  child: CircleAvatar(
                    radius: 14,
                    backgroundColor: Colors.white,
                    child: Icon(Icons.bookmark, size: 16),
                  ),
                ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(10, 10, 10, 0),
            child: Text(
              item['title'],
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(10, 3, 10, 8),
            child: Text(
              item['status'] == 'draft'
                  ? 'Draft · Only visible to you'
                  : item['status'] == 'closed'
                  ? 'Closed'
                  : item['community'] ?? 'Your community',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: AppColors.muted, fontSize: 11),
            ),
          ),
        ],
      ),
    ),
  );
  Widget _propertyBanner() => Container(
    clipBehavior: Clip.antiAlias,
    decoration: BoxDecoration(
      borderRadius: BorderRadius.circular(20),
      color: const Color(0xFFF3EFE3),
    ),
    child: Row(
      children: [
        Expanded(
          flex: 3,
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'A NEW CHAPTER STARTS HERE',
                  style: TextStyle(
                    color: Color(0xFF287B9B),
                    fontSize: 9,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 10),
                const Text(
                  'Find a home.\nFind your people.',
                  style: TextStyle(
                    fontSize: 24,
                    height: 1.2,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: newItem,
                  child: const Text('Post Property →'),
                ),
              ],
            ),
          ),
        ),
        const Expanded(
          flex: 2,
          child: ItemPhoto({'image_asset': 'house'}, height: 224),
        ),
      ],
    ),
  );
  Widget _servicesBanner() => Container(
    padding: const EdgeInsets.all(25),
    decoration: BoxDecoration(
      borderRadius: BorderRadius.circular(22),
      gradient: const LinearGradient(
        colors: [Color(0xFFF9E8AF), Color(0xFFC8E1E5)],
      ),
    ),
    child: Row(
      children: [
        const Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Big plans.\nA little help.',
                style: TextStyle(
                  fontSize: 29,
                  fontWeight: FontWeight.w800,
                  height: 1.2,
                ),
              ),
              SizedBox(height: 13),
              Text(
                'Services that make home\nfeel a little more like home.',
                style: TextStyle(height: 1.7),
              ),
            ],
          ),
        ),
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: .6),
            borderRadius: BorderRadius.circular(24),
          ),
          child: const Icon(
            Icons.home_repair_service_outlined,
            size: 58,
            color: AppColors.coral,
          ),
        ),
      ],
    ),
  );
}
