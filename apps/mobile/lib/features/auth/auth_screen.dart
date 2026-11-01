import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/demo_repository.dart';
import '../../domain/models.dart';
import '../../state/app_state.dart';
import '../../ui/app_shell.dart';
import '../../ui/neighbourhood_art.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({
    super.key,
    required this.role,
    required this.onSignedIn,
    this.preview = false,
  });
  final AppRole role;
  final VoidCallback onSignedIn;
  final bool preview;
  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final phone = TextEditingController();
  final code = TextEditingController();
  final form = GlobalKey<FormState>();
  bool sent = false;
  @override
  void dispose() {
    phone.dispose();
    code.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: Center(
        child: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 960),
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final wide = constraints.maxWidth > 700;
                  final content = Padding(
                    padding: EdgeInsets.all(wide ? 42 : 8),
                    child: Form(
                      key: form,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Row(
                            children: [
                              BrandMark(size: 38),
                              SizedBox(width: 10),
                              Text(
                                'mycommunity',
                                style: TextStyle(
                                  fontSize: 20,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: -.7,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 38),
                          Text(
                            widget.role == AppRole.guard
                                ? 'A safer community.\nIt starts with you.'
                                : 'You’re home.',
                            style: const TextStyle(
                              fontSize: 34,
                              fontWeight: FontWeight.w800,
                              letterSpacing: -1.4,
                              height: 1.2,
                            ),
                          ),
                          const SizedBox(height: 13),
                          Text(
                            sent
                                ? 'Enter the demo verification code to continue.'
                                : 'A little more connected. A lot more at home.',
                            style: const TextStyle(
                              color: AppColors.muted,
                              fontSize: 13,
                              height: 1.8,
                            ),
                          ),
                          const SizedBox(height: 25),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 6,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.peach,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: const Text(
                              'INTERACTIVE DEMO · NO SMS SENT',
                              style: TextStyle(
                                fontSize: 8,
                                letterSpacing: .7,
                                color: AppColors.coral,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                          if (!sent) ...[
                            const Label('Mobile number'),
                            TextFormField(
                              key: const Key('login-phone'),
                              controller: phone,
                              keyboardType: TextInputType.phone,
                              inputFormatters: [
                                FilteringTextInputFormatter.digitsOnly,
                                LengthLimitingTextInputFormatter(10),
                              ],
                              decoration: const InputDecoration(
                                prefixText: '+91  ',
                                hintText: 'Enter your mobile number',
                              ),
                              validator: (v) =>
                                  RegExp(r'^[6-9]\d{9}$').hasMatch(v ?? '')
                                  ? null
                                  : 'Enter a valid 10-digit mobile number',
                            ),
                          ] else ...[
                            const Label('Verification code'),
                            TextFormField(
                              key: const Key('login-code'),
                              controller: code,
                              keyboardType: TextInputType.number,
                              inputFormatters: [
                                FilteringTextInputFormatter.digitsOnly,
                                LengthLimitingTextInputFormatter(6),
                              ],
                              decoration: const InputDecoration(
                                hintText: '6-digit code',
                              ),
                              validator: (v) => v == '123456'
                                  ? null
                                  : 'Use the demo code 123456',
                            ),
                            const SizedBox(height: 10),
                            const Text(
                              'Demo code: 123456',
                              style: TextStyle(
                                fontSize: 11,
                                color: AppColors.green,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                          const SizedBox(height: 25),
                          SizedBox(
                            width: double.infinity,
                            child: FilledButton(
                              onPressed: () {
                                if (!form.currentState!.validate()) return;
                                if (sent) {
                                  widget.onSignedIn();
                                } else {
                                  setState(() => sent = true);
                                }
                              },
                              child: Text(
                                sent ? 'Verify & explore' : 'Get demo code',
                              ),
                            ),
                          ),
                          const SizedBox(height: 12),
                          SizedBox(
                            width: double.infinity,
                            child: TextButton(
                              onPressed: widget.onSignedIn,
                              child: Text(
                                'Explore as ${widget.role == AppRole.resident ? 'sample resident' : 'sample guard'}',
                              ),
                            ),
                          ),
                          if (sent)
                            Center(
                              child: TextButton(
                                onPressed: () => setState(() {
                                  sent = false;
                                  code.clear();
                                }),
                                child: const Text('Change mobile number'),
                              ),
                            ),
                          if (widget.role == AppRole.resident) ...[
                            const SizedBox(height: 14),
                            const Divider(),
                            const SizedBox(height: 16),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Text(
                                  'New to your society?',
                                  style: TextStyle(
                                    fontSize: 11,
                                    color: AppColors.muted,
                                  ),
                                ),
                                TextButton(
                                  onPressed: () => context.push('/join'),
                                  child: const Text('Join your home'),
                                ),
                              ],
                            ),
                          ],
                          const SizedBox(height: 22),
                          const Text(
                            'You’ll explore a sample profile. Your phone number is not used to send messages or create a real account.',
                            style: TextStyle(
                              fontSize: 10,
                              height: 1.7,
                              color: AppColors.muted,
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                  return Surface(
                    padding: EdgeInsets.zero,
                    child: wide
                        ? IntrinsicHeight(
                            child: Row(
                              children: [
                                Expanded(
                                  child: Container(
                                    decoration: const BoxDecoration(
                                      color: Color(0xFFF9EBDD),
                                      borderRadius: BorderRadius.horizontal(
                                        left: Radius.circular(18),
                                      ),
                                    ),
                                    padding: const EdgeInsets.all(40),
                                    child: const Column(
                                      mainAxisAlignment:
                                          MainAxisAlignment.center,
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          'GOOD NEIGHBOURS.\nGREAT BEGINNINGS.',
                                          style: TextStyle(
                                            fontSize: 9,
                                            letterSpacing: 2,
                                            color: Color(0xFFA97656),
                                            fontWeight: FontWeight.w800,
                                            height: 1.8,
                                          ),
                                        ),
                                        SizedBox(height: 20),
                                        Text(
                                          'Life’s better\ntogether.',
                                          style: TextStyle(
                                            fontSize: 43,
                                            height: 1.15,
                                            letterSpacing: -2,
                                            fontWeight: FontWeight.w800,
                                            color: Color(0xFF654F40),
                                          ),
                                        ),
                                        SizedBox(height: 30),
                                        SizedBox(
                                          height: 240,
                                          child: NeighbourhoodArt(),
                                        ),
                                        SizedBox(height: 20),
                                        Text(
                                          'Your everyday, simplified.',
                                          style: TextStyle(
                                            fontSize: 13,
                                            color: Color(0xFFA97656),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                                Expanded(child: content),
                              ],
                            ),
                          )
                        : content,
                  );
                },
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

class MembershipScreen extends ConsumerStatefulWidget {
  const MembershipScreen({super.key});
  @override
  ConsumerState<MembershipScreen> createState() => _MembershipScreenState();
}

class _MembershipScreenState extends ConsumerState<MembershipScreen> {
  final form = GlobalKey<FormState>();
  final name = TextEditingController();
  final phone = TextEditingController();
  String unit = 'A-1204';
  String residency = 'Owner';
  bool sent = false;
  bool busy = false;
  @override
  void initState() {
    super.initState();
    final backend = ref.read(backendProvider);
    if (backend != null) {
      name.text = backend.userName;
      phone.text = backend.userPhone;
    }
  }

  @override
  void dispose() {
    name.dispose();
    phone.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text(
        'Join your home',
        style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
      ),
      leading: IconButton(
        onPressed: () {
          if (context.canPop()) {
            context.pop();
          } else {
            context.go('/login');
          }
        },
        icon: const Icon(Icons.arrow_back_rounded),
      ),
    ),
    body: AppPage(
      maxWidth: 640,
      children: [
        if (sent)
          Surface(
            child: EmptyState(
              title: 'Your request is in.',
              message: ref.read(backendProvider) != null
                  ? 'Your request to join Palm Meadows, $unit, is now visible to the society administrator. You’ll see the decision on your profile.'
                  : 'Your request to join Palm Meadows, $unit, is waiting for the society admin’s approval. This is a local sample request.',
              icon: Icons.hourglass_top_rounded,
              action: FilledButton(
                onPressed: () {
                  if (context.canPop()) {
                    context.pop();
                  } else {
                    context.go('/login');
                  }
                },
                child: const Text('Done'),
              ),
            ),
          )
        else ...[
          const PageHeading(
            'Find your happy place.',
            'Tell us a little about yourself and your home.',
          ),
          Surface(
            child: Form(
              key: form,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Label('Full name'),
                  TextFormField(
                    controller: name,
                    readOnly: ref.read(backendProvider) != null,
                    decoration: const InputDecoration(hintText: 'Your name'),
                    validator: (v) => (v?.trim().length ?? 0) < 2
                        ? 'Enter your full name'
                        : null,
                  ),
                  const Label('Mobile number'),
                  TextFormField(
                    controller: phone,
                    readOnly: ref.read(backendProvider) != null,
                    keyboardType: TextInputType.phone,
                    inputFormatters: [
                      FilteringTextInputFormatter.digitsOnly,
                      LengthLimitingTextInputFormatter(10),
                    ],
                    decoration: const InputDecoration(
                      prefixText: '+91  ',
                      hintText: '10-digit mobile number',
                    ),
                    validator: (v) => RegExp(r'^[6-9]\d{9}$').hasMatch(v ?? '')
                        ? null
                        : 'Enter a valid mobile number',
                  ),
                  const Label('Society'),
                  const TextFormFieldSociety(),
                  const Label('Block & flat'),
                  DropdownButtonFormField<String>(
                    initialValue: unit,
                    items:
                        (ref.read(backendProvider)?.units.keys ??
                                demoUnitIds.keys)
                            .map(
                              (u) => DropdownMenuItem(value: u, child: Text(u)),
                            )
                            .toList(),
                    onChanged: (v) => setState(() => unit = v!),
                  ),
                  const Label('I am an'),
                  SegmentedButton<String>(
                    segments: const [
                      ButtonSegment(value: 'Owner', label: Text('Owner')),
                      ButtonSegment(value: 'Tenant', label: Text('Tenant')),
                      ButtonSegment(value: 'Family', label: Text('Family')),
                    ],
                    selected: {residency},
                    onSelectionChanged: (v) =>
                        setState(() => residency = v.first),
                  ),
                  const SizedBox(height: 26),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: busy
                          ? null
                          : () async {
                              if (!form.currentState!.validate()) return;
                              setState(() => busy = true);
                              try {
                                await ref
                                    .read(appProvider.notifier)
                                    .requestMembership(
                                      MembershipRequest(
                                        name: name.text.trim(),
                                        phone: phone.text,
                                        unit: unit,
                                        residency: residency,
                                      ),
                                    );
                                if (mounted) {
                                  setState(() {
                                    sent = true;
                                    busy = false;
                                  });
                                }
                              } catch (e) {
                                if (mounted) {
                                  setState(() => busy = false);
                                  if (context.mounted) {
                                    showToast(context, friendlyError(e));
                                  }
                                }
                              }
                            },
                      child: Text(busy ? 'Submitting…' : 'Request membership'),
                    ),
                  ),
                  const SizedBox(height: 14),
                  const Text(
                    'Membership requests need society admin approval before access is granted.',
                    style: TextStyle(
                      fontSize: 11,
                      color: AppColors.muted,
                      height: 1.7,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ],
    ),
  );
}

class TextFormFieldSociety extends StatelessWidget {
  const TextFormFieldSociety({super.key});
  @override
  Widget build(BuildContext context) => TextFormField(
    initialValue: 'Palm Meadows · Whitefield, Bengaluru',
    readOnly: true,
    decoration: const InputDecoration(
      prefixIcon: Icon(Icons.apartment_rounded),
    ),
  );
}
