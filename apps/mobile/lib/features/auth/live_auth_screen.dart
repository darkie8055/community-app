import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../services/phone_auth.dart';
import '../../state/app_state.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import '../../ui/app_shell.dart';

class LiveAuthScreen extends ConsumerStatefulWidget {
  const LiveAuthScreen({super.key, required this.onSignedIn});
  final VoidCallback onSignedIn;
  @override
  ConsumerState<LiveAuthScreen> createState() => _LiveAuthScreenState();
}

class _LiveAuthScreenState extends ConsumerState<LiveAuthScreen> {
  final form = GlobalKey<FormState>();
  final name = TextEditingController(),
      phone = TextEditingController(),
      code = TextEditingController();
  final auth = PhoneAuth();
  bool sent = false, busy = false;
  String? error;
  @override
  void dispose() {
    name.dispose();
    phone.dispose();
    code.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    if (!form.currentState!.validate()) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      if (!sent) {
        final automatic = await auth.send(phone.text);
        if (!automatic) {
          if (mounted) setState(() => sent = true);
          return;
        }
      } else {
        await auth.verify(code.text);
      }
      await ref.read(backendProvider)!.authenticateFirebase(name.text.trim());
      ref.invalidate(appProvider);
      if (mounted) widget.onSignedIn();
    } catch (e) {
      if (mounted) setState(() => error = friendlyError(e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: AppPage(
        maxWidth: 560,
        children: [
          const SizedBox(height: 45),
          const BrandMark(size: 54),
          const SizedBox(height: 30),
          const Text(
            'You’re home.',
            style: TextStyle(fontSize: 38, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 10),
          const Text(
            'Sign in with your mobile number. Your society administrator approves access to your home.',
            style: TextStyle(color: AppColors.muted, height: 1.7),
          ),
          const SizedBox(height: 28),
          Surface(
            child: Form(
              key: form,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Label('Your name'),
                  TextFormField(
                    controller: name,
                    readOnly: sent,
                    maxLength: 100,
                    validator: (v) =>
                        (v?.trim().length ?? 0) < 2 ? 'Enter your name' : null,
                  ),
                  const Label('Mobile number'),
                  TextFormField(
                    controller: phone,
                    readOnly: sent,
                    keyboardType: TextInputType.phone,
                    inputFormatters: [
                      FilteringTextInputFormatter.digitsOnly,
                      LengthLimitingTextInputFormatter(10),
                    ],
                    decoration: const InputDecoration(prefixText: '+91 '),
                    validator: (v) => RegExp(r'^[6-9]\d{9}$').hasMatch(v ?? '')
                        ? null
                        : 'Enter a valid mobile number',
                  ),
                  if (sent) ...[
                    const Label('Verification code'),
                    TextFormField(
                      controller: code,
                      keyboardType: TextInputType.number,
                      inputFormatters: [
                        FilteringTextInputFormatter.digitsOnly,
                        LengthLimitingTextInputFormatter(6),
                      ],
                      validator: (v) => (v?.length ?? 0) == 6
                          ? null
                          : 'Enter the 6-digit SMS code',
                    ),
                  ],
                  if (error != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 16),
                      child: Text(
                        error!,
                        style: const TextStyle(color: Colors.red),
                      ),
                    ),
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: busy ? null : submit,
                      child: Text(
                        busy
                            ? 'Please wait…'
                            : sent
                            ? 'Verify & continue'
                            : 'Send verification code',
                      ),
                    ),
                  ),
                  if (sent)
                    TextButton(
                      onPressed: busy
                          ? null
                          : () => setState(() => sent = false),
                      child: const Text('Change number / resend'),
                    ),
                  const SizedBox(height: 14),
                  const Text(
                    'SMS verification is provided by Firebase. Your phone number is used to secure your account.',
                    style: TextStyle(
                      fontSize: 11,
                      color: AppColors.muted,
                      height: 1.6,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    ),
  );
}

class LiveOnboardingScreen extends ConsumerStatefulWidget {
  const LiveOnboardingScreen({super.key});
  @override
  ConsumerState<LiveOnboardingScreen> createState() =>
      _LiveOnboardingScreenState();
}

class _LiveOnboardingScreenState extends ConsumerState<LiveOnboardingScreen> {
  List<dynamic> communities = [], units = [], memberships = [];
  String? community, unit, error;
  String residency = 'owner';
  bool busy = true;
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final backend = ref.read(backendProvider)!;
      final societies = (await backend.dio.get<List<dynamic>>(
        '/v1/onboarding/communities',
      )).data!;
      final requests = (await backend.dio.get<List<dynamic>>(
        '/v1/onboarding/memberships',
      )).data!;
      if (mounted) {
        setState(() {
          communities = societies;
          memberships = requests;
          busy = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          error = friendlyError(e);
          busy = false;
        });
      }
    }
  }

  Future<void> choose(String id) async {
    setState(() {
      community = id;
      unit = null;
      units = [];
      busy = true;
    });
    try {
      final values =
          (await ref
                  .read(backendProvider)!
                  .dio
                  .get<List<dynamic>>('/v1/onboarding/communities/$id/units'))
              .data!;
      if (mounted) setState(() => units = values);
    } catch (e) {
      if (mounted) setState(() => error = friendlyError(e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> request() async {
    if (community == null || unit == null) {
      setState(() => error = 'Select a society and a flat.');
      return;
    }
    setState(() => busy = true);
    try {
      await ref
          .read(backendProvider)!
          .dio
          .post<void>(
            '/v1/communities/$community/memberships',
            data: {'unit_id': unit, 'role': residency},
          );
      await load();
    } catch (e) {
      if (mounted) setState(() => error = friendlyError(e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> open(String id) async {
    setState(() => busy = true);
    try {
      await ref.read(backendProvider)!.selectCommunity(id);
      ref.invalidate(appProvider);
      if (mounted) context.go('/');
    } catch (e) {
      if (mounted) setState(() => error = friendlyError(e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Find your home')),
    body: AppPage(
      maxWidth: 650,
      children: [
        const PageHeading(
          'A place to belong.',
          'Choose your society and request membership. The administrator will review your request.',
        ),
        if (error != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 15),
            child: Text(error!, style: const TextStyle(color: Colors.red)),
          ),
        for (final m in memberships)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Surface(
              child: ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.home_outlined),
                title: Text(
                  communities
                          .where((dynamic c) => c['id'] == m['community_id'])
                          .firstOrNull?['name'] ??
                      'Your society',
                ),
                subtitle: Text('${m['role']} · ${m['status']}'),
                trailing: m['status'] == 'approved'
                    ? TextButton(
                        onPressed: busy ? null : () => open(m['community_id']),
                        child: const Text('Open'),
                      )
                    : null,
              ),
            ),
          ),
        if (memberships.isNotEmpty)
          TextButton.icon(
            onPressed: busy ? null : load,
            icon: const Icon(Icons.refresh),
            label: const Text('Check approval status'),
          ),
        Surface(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Label('Society'),
              DropdownButtonFormField<String>(
                initialValue: community,
                isExpanded: true,
                items: communities
                    .map(
                      (c) => DropdownMenuItem<String>(
                        value: c['id'],
                        child: Text(
                          '${c['name']} · ${c['city']}',
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    )
                    .toList(),
                onChanged: busy ? null : (v) => choose(v!),
              ),
              const Label('Flat'),
              DropdownButtonFormField<String>(
                key: ValueKey(community),
                initialValue: unit,
                items: units
                    .map(
                      (u) => DropdownMenuItem<String>(
                        value: u['id'],
                        child: Text(u['label']),
                      ),
                    )
                    .toList(),
                onChanged: busy ? null : (v) => setState(() => unit = v),
              ),
              const Label('I am a'),
              DropdownButtonFormField<String>(
                initialValue: residency,
                items: ['owner', 'tenant', 'family']
                    .map(
                      (r) => DropdownMenuItem(
                        value: r,
                        child: Text(r[0].toUpperCase() + r.substring(1)),
                      ),
                    )
                    .toList(),
                onChanged: (v) => residency = v!,
              ),
              const SizedBox(height: 24),
              FilledButton(
                onPressed: busy ? null : request,
                child: Text(busy ? 'Please wait…' : 'Request membership'),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}
