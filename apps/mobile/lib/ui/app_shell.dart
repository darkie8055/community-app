import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../domain/models.dart';
import '../state/app_state.dart';
import 'theme.dart';

class AppShell extends ConsumerWidget {
  const AppShell({
    super.key,
    required this.role,
    required this.location,
    required this.child,
    required this.preview,
    required this.onSwitch,
  });
  final AppRole role;
  final String location;
  final Widget child;
  final bool preview;
  final VoidCallback onSwitch;
  List<(String, IconData, String)> get items => role == AppRole.resident
      ? [
          ('Social', Icons.grid_view_rounded, '/'),
          ('Homes', Icons.home_work_outlined, '/homes'),
          ('Community', Icons.groups_outlined, '/community'),
          ('Buy & Sell', Icons.handshake_outlined, '/marketplace'),
          ('Stores', Icons.storefront_outlined, '/stores'),
        ]
      : [
          ('Gate', Icons.grid_view_rounded, '/'),
          ('Visitors', Icons.people_outline, '/visitors'),
          ('Community', Icons.groups_outlined, '/community'),
          ('Inbox', Icons.notifications_none, '/notifications'),
          ('Profile', Icons.person_outline, '/profile'),
        ];
  int get selected {
    final index = items.indexWhere((i) => i.$3 == location);
    return index < 0
        ? (location.startsWith('/visitor') && role == AppRole.guard ? 1 : 0)
        : index;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final wide = MediaQuery.sizeOf(context).width >= 1000;
    final state = ref.watch(appProvider);
    final backend = ref.read(backendProvider);
    final community = backend?.communityName ?? 'Palm Meadows';
    final home = backend?.ownUnits.keys.firstOrNull ?? 'A-1204';
    final name =
        backend?.userName ??
        (role == AppRole.resident ? 'Aarav Sharma' : 'Rajesh Kumar');
    void navigate(String route) => context.go(route);
    return Scaffold(
      body: SafeArea(
        child: Row(
          children: [
            if (wide)
              Container(
                width: 235,
                color: Colors.white,
                child: Material(
                  color: Colors.white,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Padding(
                        padding: EdgeInsets.fromLTRB(25, 30, 20, 30),
                        child: Row(
                          children: [
                            BrandMark(size: 35),
                            SizedBox(width: 10),
                            Text(
                              'mycommunity',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w800,
                                letterSpacing: -.8,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 25),
                        child: Text(
                          role == AppRole.guard
                              ? 'SECURITY WORKSPACE'
                              : 'YOUR EVERYDAY, CONNECTED',
                          style: const TextStyle(
                            fontSize: 9,
                            letterSpacing: 1.2,
                            color: AppColors.muted,
                          ),
                        ),
                      ),
                      const SizedBox(height: 18),
                      for (var i = 0; i < items.length; i++)
                        Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 13,
                            vertical: 3,
                          ),
                          child: ListTile(
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            tileColor: selected == i ? AppColors.peach : null,
                            leading: Icon(
                              items[i].$2,
                              color: AppColors.ink,
                              size: 22,
                            ),
                            title: Text(
                              items[i].$1,
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: selected == i
                                    ? FontWeight.w800
                                    : FontWeight.w500,
                              ),
                            ),
                            onTap: () => navigate(items[i].$3),
                          ),
                        ),
                      const Padding(
                        padding: EdgeInsets.symmetric(
                          horizontal: 24,
                          vertical: 13,
                        ),
                        child: Divider(),
                      ),
                      if (role == AppRole.resident) ...[
                        ListTile(
                          leading: const Icon(Icons.people_outline),
                          title: const Text(
                            'My visitors',
                            style: TextStyle(fontSize: 13),
                          ),
                          onTap: () => navigate('/visitors'),
                        ),
                        ListTile(
                          leading: const Icon(Icons.notifications_none),
                          title: const Text(
                            'Notifications',
                            style: TextStyle(fontSize: 13),
                          ),
                          trailing: state.unread > 0
                              ? Badge(label: Text('${state.unread}'))
                              : null,
                          onTap: () => navigate('/notifications'),
                        ),
                      ],
                      const Spacer(),
                      Container(
                        margin: const EdgeInsets.all(18),
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          color: AppColors.canvas,
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: const Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(Icons.home_outlined, size: 30),
                            SizedBox(height: 12),
                            Text(
                              'Good neighbours.\nGreat beginnings.',
                              style: TextStyle(
                                fontWeight: FontWeight.w800,
                                fontSize: 18,
                                height: 1.5,
                              ),
                            ),
                            SizedBox(height: 8),
                            Text(
                              'A little more connected.\nA lot more at home.',
                              style: TextStyle(
                                fontSize: 11,
                                color: AppColors.muted,
                                height: 1.6,
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (preview)
                        Padding(
                          padding: const EdgeInsets.fromLTRB(12, 0, 12, 10),
                          child: TextButton.icon(
                            onPressed: onSwitch,
                            icon: const Icon(Icons.swap_horiz),
                            label: Text(
                              role == AppRole.resident
                                  ? 'Switch to guard app'
                                  : 'Switch to resident app',
                              style: const TextStyle(fontSize: 11),
                            ),
                          ),
                        ),
                      ListTile(
                        leading: CircleAvatar(
                          radius: 17,
                          backgroundColor: const Color(0xFF985D5E),
                          child: Text(
                            name.isEmpty ? 'U' : name[0],
                            style: const TextStyle(color: Colors.white),
                          ),
                        ),
                        title: Text(
                          name,
                          style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 12,
                          ),
                        ),
                        subtitle: const Text(
                          'My profile',
                          style: TextStyle(fontSize: 10),
                        ),
                        onTap: () => navigate('/profile'),
                      ),
                      const SizedBox(height: 16),
                    ],
                  ),
                ),
              ),
            Expanded(
              child: Column(
                children: [
                  Container(
                    height: wide ? 82 : 73,
                    padding: EdgeInsets.symmetric(horizontal: wide ? 30 : 16),
                    decoration: const BoxDecoration(
                      color: AppColors.canvas,
                      border: Border(
                        bottom: BorderSide(color: Color(0xFFDCD9D3)),
                      ),
                    ),
                    child: Row(
                      children: [
                        if (wide || MediaQuery.sizeOf(context).width > 380) ...[
                          const CircleAvatar(
                            radius: 19,
                            backgroundColor: Colors.white,
                            child: Icon(
                              Icons.apartment,
                              color: AppColors.ink,
                              size: 21,
                            ),
                          ),
                          const SizedBox(width: 10),
                        ],
                        Expanded(
                          child: InkWell(
                            onTap: () => showModalBottomSheet<void>(
                              context: context,
                              showDragHandle: true,
                              builder: (ctx) => Padding(
                                padding: const EdgeInsets.all(25),
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      community,
                                      style: const TextStyle(
                                        fontSize: 23,
                                        fontWeight: FontWeight.w800,
                                      ),
                                    ),
                                    const SizedBox(height: 8),
                                    Text('$home · Your community'),
                                    const SizedBox(height: 20),
                                    FilledButton.icon(
                                      onPressed: () {
                                        Navigator.pop(ctx);
                                        context.push('/join');
                                      },
                                      icon: const Icon(Icons.add),
                                      label: const Text('Join another home'),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Flexible(
                                      child: Text(
                                        community,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                          fontSize: 15,
                                          fontWeight: FontWeight.w800,
                                        ),
                                      ),
                                    ),
                                    const Icon(
                                      Icons.keyboard_arrow_down,
                                      size: 18,
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 3),
                                Text(
                                  role == AppRole.guard
                                      ? 'Main Gate · Security desk'
                                      : '$home · My community',
                                  style: const TextStyle(
                                    fontSize: 10,
                                    color: AppColors.muted,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        IconButton(
                          tooltip: 'Search visitors',
                          onPressed: () => navigate('/visitors'),
                          icon: const Icon(Icons.search, size: 23),
                        ),
                        IconButton(
                          tooltip: 'Notifications',
                          onPressed: () => navigate('/notifications'),
                          icon: Badge(
                            isLabelVisible: state.unread > 0,
                            backgroundColor: const Color(0xFFEF5B75),
                            child: const Icon(
                              Icons.notifications_none,
                              size: 23,
                            ),
                          ),
                        ),
                        IconButton(
                          tooltip: 'My profile',
                          onPressed: () => navigate('/profile'),
                          icon: CircleAvatar(
                            radius: 17,
                            backgroundColor: const Color(0xFF985D5E),
                            child: Text(
                              name.isEmpty ? 'U' : name[0],
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 15,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (state.error != null)
                    MaterialBanner(
                      content: Text(
                        state.error!,
                        style: const TextStyle(fontSize: 12),
                      ),
                      actions: [
                        TextButton(
                          onPressed: () =>
                              ref.read(appProvider.notifier).refreshServer(),
                          child: const Text('Retry'),
                        ),
                      ],
                    ),
                  Expanded(child: child),
                ],
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: wide
          ? null
          : Container(
              decoration: const BoxDecoration(
                color: Colors.white,
                border: Border(top: BorderSide(color: AppColors.line)),
              ),
              child: SafeArea(
                top: false,
                child: Row(
                  children: [
                    for (var i = 0; i < items.length; i++)
                      Expanded(
                        child: InkWell(
                          onTap: () => navigate(items[i].$3),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Container(
                                  width: 36,
                                  height: 31,
                                  decoration: i == 2
                                      ? BoxDecoration(
                                          shape: BoxShape.circle,
                                          border: Border.all(
                                            color: const Color(0xFFCEDCB6),
                                            width: 1.7,
                                          ),
                                        )
                                      : null,
                                  child: Icon(
                                    items[i].$2,
                                    size: 24,
                                    color: selected == i
                                        ? AppColors.ink
                                        : const Color(0xFF909995),
                                  ),
                                ),
                                const SizedBox(height: 3),
                                Text(
                                  items[i].$1,
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: selected == i
                                        ? FontWeight.w800
                                        : FontWeight.w500,
                                    color: selected == i
                                        ? AppColors.ink
                                        : AppColors.muted,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
    );
  }
}

class BrandMark extends StatelessWidget {
  const BrandMark({super.key, this.size = 42});
  final double size;
  @override
  Widget build(BuildContext context) => Container(
    width: size,
    height: size,
    decoration: BoxDecoration(
      color: AppColors.yellow,
      borderRadius: BorderRadius.circular(size * .28),
    ),
    child: Icon(
      Icons.holiday_village_rounded,
      color: AppColors.ink,
      size: size * .64,
    ),
  );
}
