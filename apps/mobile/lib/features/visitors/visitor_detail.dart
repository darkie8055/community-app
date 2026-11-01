import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../data/demo_repository.dart';
import '../../domain/models.dart';
import '../../state/app_state.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';

class VisitorDetail extends ConsumerStatefulWidget {
  const VisitorDetail({super.key, required this.id, required this.role});
  final String id;
  final AppRole role;
  @override
  ConsumerState<VisitorDetail> createState() => _VisitorDetailState();
}

class _VisitorDetailState extends ConsumerState<VisitorDetail> {
  bool busy = false;
  VisitorEntry? loaded;
  String? loadError;
  bool loading = false;
  int generation = 0;
  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void didUpdateWidget(VisitorDetail old) {
    super.didUpdateWidget(old);
    if (old.id != widget.id) {
      loaded = null;
      load();
    }
  }

  Future<void> load() async {
    final backend = ref.read(backendProvider);
    if (backend == null) return;
    final version = ++generation;
    setState(() {
      loading = true;
      loadError = null;
    });
    try {
      final entry = await backend.visit(widget.id);
      if (mounted && generation == version) setState(() => loaded = entry);
    } catch (e) {
      if (mounted && generation == version) {
        setState(() => loadError = friendlyError(e));
      }
    } finally {
      if (mounted && generation == version) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final communityName =
        ref.read(backendProvider)?.communityName ?? 'Palm Meadows';
    final entry =
        ref
            .watch(appProvider)
            .entries
            .where(
              (v) =>
                  v.id == widget.id &&
                  (ref.read(backendProvider) != null ||
                      (v.communityId == communityId &&
                          (widget.role == AppRole.guard ||
                              v.unitId == residentUnitId))),
            )
            .firstOrNull ??
        loaded;
    if (entry == null) {
      return AppPage(
        children: [
          if (loading)
            const Center(child: CircularProgressIndicator())
          else
            EmptyState(
              title: 'Visit not found',
              message:
                  loadError ?? 'This visit is not available for your home.',
              action: TextButton(onPressed: load, child: const Text('Retry')),
            ),
        ],
      );
    }
    return AppPage(
      maxWidth: 760,
      children: [
        TextButton.icon(
          onPressed: () => context.go('/visitors'),
          icon: const Icon(Icons.arrow_back_rounded, size: 17),
          label: const Text('Back to visitors'),
        ),
        const SizedBox(height: 14),
        PageHeading(
          entry.status == VisitStatus.pending
              ? 'Someone’s at your gate'
              : 'Visit details',
          'Main Gate · $communityName',
        ),
        Surface(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  VisitorAvatar(entry, size: 72),
                  const SizedBox(width: 18),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          entry.name,
                          style: const TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -.5,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          entry.description,
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.muted,
                          ),
                        ),
                        const SizedBox(height: 10),
                        StatusPill(entry.status),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 26),
              const Divider(),
              const SizedBox(height: 12),
              _detail(
                'Visiting',
                '${entry.unit} · $communityName',
                Icons.apartment_rounded,
              ),
              _detail(
                'Mobile number',
                '+91 ${entry.phone}',
                Icons.phone_outlined,
              ),
              _detail(
                'Purpose',
                entry.purpose.isEmpty ? entry.type.label : entry.purpose,
                Icons.notes_rounded,
              ),
              _detail(
                'Number of people',
                '${entry.people} ${entry.people == 1 ? 'person' : 'people'}',
                Icons.people_outline_rounded,
              ),
              if (entry.vehicle.isNotEmpty)
                _detail(
                  'Vehicle',
                  entry.vehicle.toUpperCase(),
                  Icons.directions_car_outlined,
                ),
              const SizedBox(height: 16),
              if (entry.status == VisitStatus.pending &&
                  widget.role == AppRole.resident) ...[
                Surface(
                  color: const Color(0xFFFFF7E8),
                  borderColor: const Color(0xFFFFF7E8),
                  padding: const EdgeInsets.all(14),
                  child: const Row(
                    children: [
                      Icon(
                        Icons.info_outline,
                        size: 17,
                        color: Color(0xFFAD7D3E),
                      ),
                      SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Please approve only if you recognise this visitor or are expecting this delivery.',
                          style: TextStyle(
                            fontSize: 11,
                            height: 1.6,
                            color: Color(0xFF8E713F),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        key: const Key('deny-visitor'),
                        onPressed: busy
                            ? null
                            : () => _change(entry, VisitStatus.denied),
                        child: const Text('Deny entry'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: FilledButton.icon(
                        key: const Key('approve-visitor'),
                        onPressed: busy
                            ? null
                            : () => _change(entry, VisitStatus.approved),
                        icon: const Icon(Icons.check_rounded, size: 19),
                        label: const Text('Approve entry'),
                      ),
                    ),
                  ],
                ),
              ],
              if (widget.role == AppRole.guard &&
                  entry.status == VisitStatus.pending)
                const Surface(
                  padding: EdgeInsets.all(16),
                  color: Color(0xFFFFF7E8),
                  child: Row(
                    children: [
                      Icon(
                        Icons.hourglass_top_rounded,
                        color: Color(0xFFAD7D3E),
                        size: 20,
                      ),
                      SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'Waiting for the resident to approve. Do not allow entry yet.',
                          style: TextStyle(fontSize: 12, height: 1.7),
                        ),
                      ),
                    ],
                  ),
                ),
              if (widget.role == AppRole.guard &&
                  entry.status == VisitStatus.approved)
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    key: const Key('record-entry'),
                    onPressed: busy
                        ? null
                        : () => _change(entry, VisitStatus.inside),
                    icon: const Icon(Icons.login_rounded),
                    label: const Text('Record entry'),
                  ),
                ),
              if (widget.role == AppRole.resident &&
                  entry.status == VisitStatus.approved) ...[
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    key: const Key('visitor-share-pass'),
                    onPressed: () => context.push('/visitor/${entry.id}/pass'),
                    icon: const Icon(Icons.qr_code_2),
                    label: const Text('Generate & share visitor pass'),
                  ),
                ),
                const SizedBox(height: 16),
              ],
              if (widget.role == AppRole.guard &&
                  entry.status == VisitStatus.inside)
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    key: const Key('record-exit'),
                    onPressed: busy
                        ? null
                        : () => _change(entry, VisitStatus.exited),
                    icon: const Icon(Icons.logout_rounded),
                    label: const Text('Record exit'),
                  ),
                ),
              if (entry.status == VisitStatus.denied)
                const Text(
                  'Entry denied. This visitor cannot be checked in.',
                  style: TextStyle(
                    color: Color(0xFFBC4A48),
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              if (widget.role == AppRole.resident &&
                  entry.status == VisitStatus.approved)
                const Text(
                  'You’re all set. Security will record the entry when your visitor arrives.',
                  style: TextStyle(
                    fontSize: 12,
                    color: AppColors.green,
                    height: 1.7,
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 22),
        Surface(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SectionTitle('Visit timeline'),
              const SizedBox(height: 20),
              _timeline(
                'Registered at Main Gate',
                entry.createdAt,
                Icons.door_front_door_outlined,
              ),
              if (entry.approvedAt != null)
                _timeline(
                  'Approved by resident',
                  entry.approvedAt!,
                  Icons.check_circle_outline_rounded,
                ),
              if (entry.deniedAt != null)
                _timeline(
                  'Denied by resident',
                  entry.deniedAt!,
                  Icons.block_rounded,
                ),
              if (entry.enteredAt != null)
                _timeline(
                  'Entry recorded by security',
                  entry.enteredAt!,
                  Icons.login_rounded,
                ),
              if (entry.exitedAt != null)
                _timeline(
                  'Exit recorded by security',
                  entry.exitedAt!,
                  Icons.logout_rounded,
                ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _detail(String label, String value, IconData icon) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 12),
    child: Row(
      children: [
        Icon(icon, size: 18, color: AppColors.muted),
        const SizedBox(width: 13),
        Expanded(
          child: Text(
            label,
            style: const TextStyle(fontSize: 11, color: AppColors.muted),
          ),
        ),
        Flexible(
          child: Text(
            value,
            textAlign: TextAlign.right,
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
          ),
        ),
      ],
    ),
  );
  Widget _timeline(String label, DateTime time, IconData icon) => Padding(
    padding: const EdgeInsets.only(bottom: 20),
    child: Row(
      children: [
        CircleAvatar(
          radius: 18,
          backgroundColor: const Color(0xFFF0F5EE),
          child: Icon(icon, size: 17, color: AppColors.green),
        ),
        const SizedBox(width: 13),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                DateFormat('d MMM yyyy · h:mm:ss a').format(time.toLocal()),
                style: const TextStyle(fontSize: 10, color: AppColors.muted),
              ),
            ],
          ),
        ),
      ],
    ),
  );
  Future<void> _change(VisitorEntry entry, VisitStatus status) async {
    if (status == VisitStatus.denied) {
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Deny entry?'),
          content: Text(
            'Security will be told that ${entry.name} is not allowed to enter.',
          ),
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
      if (confirmed != true || !mounted) return;
    }
    setState(() => busy = true);
    try {
      await ref
          .read(appProvider.notifier)
          .changeStatus(entry.id, status, widget.role);
      await load();
      if (mounted) showToast(context, '${entry.name} · ${status.label}');
    } catch (e) {
      if (mounted) showToast(context, friendlyError(e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }
}
