import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../domain/models.dart';
import '../../state/app_state.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';

class VisitorsScreen extends ConsumerStatefulWidget {
  const VisitorsScreen({super.key, required this.role});
  final AppRole role;
  @override
  ConsumerState<VisitorsScreen> createState() => _VisitorsScreenState();
}

class _VisitorsScreenState extends ConsumerState<VisitorsScreen> {
  String query = '';
  VisitStatus? status;
  VisitType? type;
  bool todayOnly = false;

  List<VisitorEntry> remoteEntries = [];
  String? cursor, error;
  bool loading = false;
  int generation = 0;
  Timer? debounce;
  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void didUpdateWidget(VisitorsScreen old) {
    super.didUpdateWidget(old);
    if (old.role != widget.role) {
      remoteEntries = [];
      load();
    }
  }

  @override
  void dispose() {
    debounce?.cancel();
    super.dispose();
  }

  Future<void> load({bool more = false}) async {
    final backend = ref.read(backendProvider);
    if (backend == null) return;
    final version = ++generation;
    setState(() {
      loading = true;
      error = null;
      if (!more) {
        remoteEntries = [];
        cursor = null;
      }
    });
    final now = DateTime.now();
    final day = DateTime(now.year, now.month, now.day);
    try {
      final data = (await backend.dio.get<Map<String, dynamic>>(
        '/v1/communities/${backend.communityId}/visitor-entries',
        queryParameters: {
          'limit': 50,
          if (query.isNotEmpty) 'search': query,
          if (status != null) 'status': status!.name,
          if (type != null) 'type': type!.name,
          if (todayOnly) 'from': day.toUtc().toIso8601String(),
          if (todayOnly)
            'until': DateTime(
              now.year,
              now.month,
              now.day + 1,
            ).toUtc().toIso8601String(),
          if (more && cursor != null) 'cursor': cursor,
        },
      )).data!;
      if (!mounted || generation != version) return;
      final next = (data['items'] as List)
          .map((v) => VisitorEntry.fromJson(Map<String, dynamic>.from(v)))
          .toList();
      setState(() {
        remoteEntries = more ? [...remoteEntries, ...next] : next;
        cursor = data['next_cursor'];
      });
    } catch (e) {
      if (mounted && generation == version) {
        setState(() => error = friendlyError(e));
      }
    } finally {
      if (mounted && generation == version) setState(() => loading = false);
    }
  }

  void filtersChanged() {
    debounce?.cancel();
    generation++;
    load();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(appProvider);
    final source = ref.read(backendProvider) != null
        ? remoteEntries
        : widget.role == AppRole.guard
        ? state.entries
        : state.residentEntries;
    final now = DateTime.now();
    final entries = source.where((v) {
      final day = v.createdAt.toLocal();
      return (status == null || status == v.status) &&
          (type == null || type == v.type) &&
          (!todayOnly ||
              (day.year == now.year &&
                  day.month == now.month &&
                  day.day == now.day)) &&
          '${v.name} ${v.company} ${v.unit} ${v.phone}'.toLowerCase().contains(
            query.toLowerCase(),
          );
    }).toList();
    return AppPage(
      children: [
        const PageHeading(
          'Your visitor book',
          'Every arrival, every goodbye. All in one place.',
        ),
        Row(
          children: [
            Expanded(
              child: TextField(
                key: const Key('visitor-search'),
                onChanged: (v) {
                  setState(() => query = v);
                  debounce?.cancel();
                  generation++;
                  debounce = Timer(const Duration(milliseconds: 300), load);
                },
                decoration: const InputDecoration(
                  hintText: 'Search name, company or flat',
                  prefixIcon: Icon(Icons.search_rounded, size: 20),
                ),
              ),
            ),
            const SizedBox(width: 12),
            FilledButton.icon(
              onPressed: () => context.push(
                widget.role == AppRole.guard ? '/new-visitor' : '/invite',
              ),
              icon: const Icon(Icons.add_rounded, size: 18),
              label: Text(
                widget.role == AppRole.guard ? 'New visitor' : 'Invite',
                style: const TextStyle(fontSize: 11),
              ),
            ),
          ],
        ),
        const SizedBox(height: 20),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              for (final filter in <VisitStatus?>[null, ...VisitStatus.values])
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(
                      filter?.label ?? 'All visitors',
                      style: TextStyle(
                        fontSize: 11,
                        color: status == filter
                            ? AppColors.coral
                            : AppColors.muted,
                      ),
                    ),
                    selected: status == filter,
                    onSelected: (_) {
                      setState(() => status = filter);
                      filtersChanged();
                    },
                    showCheckmark: false,
                    backgroundColor: Colors.white,
                    selectedColor: AppColors.peach,
                    side: BorderSide(
                      color: status == filter
                          ? const Color(0xFFF0CCBF)
                          : AppColors.line,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        Row(
          children: [
            FilterChip(
              label: const Text('Today', style: TextStyle(fontSize: 10)),
              avatar: const Icon(Icons.calendar_today_outlined, size: 14),
              selected: todayOnly,
              onSelected: (v) {
                setState(() => todayOnly = v);
                filtersChanged();
              },
            ),
            const SizedBox(width: 12),
            DropdownButton<VisitType?>(
              value: type,
              hint: const Text('All types'),
              underline: const SizedBox.shrink(),
              style: const TextStyle(
                fontFamily: 'Manrope',
                color: AppColors.ink,
                fontSize: 11,
              ),
              items: [
                const DropdownMenuItem(value: null, child: Text('All types')),
                ...VisitType.values.map(
                  (t) => DropdownMenuItem(value: t, child: Text(t.label)),
                ),
              ],
              onChanged: (v) {
                setState(() => type = v);
                filtersChanged();
              },
            ),
            const Spacer(),
            Text(
              '${entries.length} visits',
              style: const TextStyle(fontSize: 10, color: AppColors.muted),
            ),
          ],
        ),
        const SizedBox(height: 16),
        Surface(
          child: Column(
            children: [
              if (error != null)
                EmptyState(
                  title: 'Unable to load visitors',
                  message: error!,
                  action: TextButton(
                    onPressed: () => load(),
                    child: const Text('Retry'),
                  ),
                ),
              if (loading)
                const Padding(
                  padding: EdgeInsets.all(20),
                  child: CircularProgressIndicator(),
                ),
              if (entries.isEmpty && !loading && error == null)
                const EmptyState(
                  title: 'No visits found',
                  message: 'Try another name or change your filters.',
                  icon: Icons.search_off_rounded,
                ),
              for (var i = 0; i < entries.length; i++) ...[
                VisitorTile(
                  entries[i],
                  showUnit: widget.role == AppRole.guard,
                  onTap: () async {
                    await context.push('/visitor/${entries[i].id}');
                    if (mounted) load();
                  },
                ),
                if (i < entries.length - 1) const Divider(),
              ],
              if (cursor != null)
                TextButton(
                  onPressed: loading ? null : () => load(more: true),
                  child: const Text('Load more visitors'),
                ),
            ],
          ),
        ),
      ],
    );
  }
}
