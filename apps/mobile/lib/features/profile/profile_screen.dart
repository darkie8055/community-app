import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../domain/models.dart';
import '../../state/app_state.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({
    super.key,
    required this.role,
    required this.preview,
    required this.onSwitch,
    required this.onLogout,
  });
  final AppRole role;
  final bool preview;
  final VoidCallback onSwitch, onLogout;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final resident = role == AppRole.resident;
    final request = ref.watch(appProvider).membership;
    final backend = ref.read(backendProvider);
    final live = backend?.firebaseMode == true;
    final name =
        backend?.userName ?? (resident ? 'Aarav Sharma' : 'Rajesh Kumar');
    return AppPage(
      maxWidth: 760,
      children: [
        const PageHeading(
          'Make yourself at home.',
          'Your profile and community membership.',
        ),
        Surface(
          child: Column(
            children: [
              CircleAvatar(
                radius: 38,
                backgroundColor: AppColors.peach,
                child: Text(
                  name.isEmpty ? 'U' : name[0],
                  style: const TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                    color: AppColors.coral,
                  ),
                ),
              ),
              const SizedBox(height: 15),
              Text(
                name,
                style: const TextStyle(
                  fontSize: 23,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 7),
              Text(
                resident ? 'Resident · Owner' : 'Security guard · Main Gate',
                style: const TextStyle(fontSize: 12, color: AppColors.muted),
              ),
              const SizedBox(height: 18),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.verified_rounded,
                    color: AppColors.green,
                    size: 17,
                  ),
                  SizedBox(width: 6),
                  Text(
                    live ? 'Phone verified' : 'Verified demo profile',
                    style: TextStyle(fontSize: 11, color: AppColors.green),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 22),
        Surface(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SectionTitle('Community membership'),
              const SizedBox(height: 15),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const CircleAvatar(
                  backgroundColor: Color(0xFFF1F5EF),
                  child: Icon(Icons.apartment_rounded, color: AppColors.green),
                ),
                title: Text(
                  backend?.communityName ?? 'Palm Meadows',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
                ),
                subtitle: Text(
                  resident
                      ? (backend?.ownUnits.keys.join(', ') ??
                            'Tower A · Floor 12 · Flat 1204')
                      : 'Main Gate · Assigned security team',
                  style: const TextStyle(fontSize: 11, color: AppColors.muted),
                ),
                trailing: const Icon(
                  Icons.check_circle_outline,
                  color: AppColors.green,
                  size: 20,
                ),
              ),
              if (resident)
                TextButton.icon(
                  onPressed: () => context.push('/join'),
                  icon: const Icon(Icons.add_rounded, size: 18),
                  label: const Text('Request another membership'),
                ),
              if (request != null) ...[
                const Divider(),
                const SizedBox(height: 15),
                Row(
                  children: [
                    const Icon(
                      Icons.hourglass_top_rounded,
                      size: 19,
                      color: Color(0xFFAD7D3E),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        '${request.unit} · ${request.residency}\n${request.status == 'pending' ? 'Membership request pending admin approval' : 'Membership ${request.status} by admin'}',
                        style: const TextStyle(fontSize: 11, height: 1.7),
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 22),
        Surface(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SectionTitle(live ? 'Notifications' : 'Explore the demo'),
              const SizedBox(height: 12),
              Text(
                live
                    ? 'Allow notifications for visitor arrivals and approval updates. You can manage permission in your device settings.'
                    : ref.read(backendProvider) != null
                    ? 'This preview uses sample accounts connected to your local community server. Visitor changes and membership requests are shared with the admin panel. Live push delivery needs Firebase configuration.'
                    : 'This preview uses sample residents and saves changes on this device. No SMS or push notifications are sent. Use the resident and guard views to try the full visitor journey.',
                style: const TextStyle(
                  fontSize: 12,
                  color: AppColors.muted,
                  height: 1.8,
                ),
              ),
              const SizedBox(height: 18),
              if (live)
                FilledButton.icon(
                  onPressed: () async {
                    try {
                      await backend!.enablePush((id) {
                        if (context.mounted) context.push('/visitor/$id');
                      });
                      if (context.mounted) {
                        showToast(context, 'Notification preferences updated.');
                      }
                    } catch (e) {
                      if (context.mounted) showToast(context, friendlyError(e));
                    }
                  },
                  icon: const Icon(Icons.notifications_active_outlined),
                  label: const Text('Enable notifications'),
                ),
              if (preview)
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: onSwitch,
                    icon: const Icon(Icons.swap_horiz_rounded, size: 19),
                    label: Text(
                      resident
                          ? 'Switch to guard app'
                          : 'Switch to resident app',
                    ),
                  ),
                ),
              const SizedBox(height: 10),
              if (ref.read(backendProvider) == null)
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: () => _reset(context, ref),
                    icon: const Icon(Icons.restart_alt_rounded, size: 18),
                    label: const Text('Reset sample data'),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 22),
        SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            onPressed: onLogout,
            icon: const Icon(Icons.logout_rounded, size: 18),
            label: const Text('Sign out / view login'),
          ),
        ),
        const SizedBox(height: 24),
        const Center(
          child: Text(
            'MyCommunity · Version 0.1.0\nA little more connected.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.muted, fontSize: 10, height: 1.8),
          ),
        ),
      ],
    );
  }

  Future<void> _reset(BuildContext context, WidgetRef ref) async {
    final yes = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Reset this demo?'),
        content: const Text(
          'Your local sample visits, photos and membership request will be replaced with the original sample data.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Keep changes'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Reset demo'),
          ),
        ],
      ),
    );
    if (yes == true) {
      await ref.read(appProvider.notifier).resetDemo();
      if (context.mounted) {
        showToast(context, 'Sample data restored.');
        context.go('/');
      }
    }
  }
}
