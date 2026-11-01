import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../../domain/models.dart';
import '../../services/visitor_pass_repository.dart';
import '../../state/app_state.dart';
import '../../ui/widgets.dart';

class VerifyPassScreen extends ConsumerStatefulWidget {
  const VerifyPassScreen({super.key});
  @override
  ConsumerState<VerifyPassScreen> createState() => _VerifyPassScreenState();
}

class _VerifyPassScreenState extends ConsumerState<VerifyPassScreen> {
  final code = TextEditingController();
  VisitorEntry? visitor;
  String? error, verifiedCode;
  bool busy = false;
  @override
  void dispose() {
    code.dispose();
    super.dispose();
  }

  Future<void> verify([String? scanned]) async {
    if (busy) return;
    final input = scanned ?? code.text;
    setState(() {
      busy = true;
      error = null;
      visitor = null;
      verifiedCode = null;
    });
    try {
      final entry = await ref.read(visitorPassProvider).verify(input);
      if (mounted) {
        setState(() {
          visitor = entry;
          verifiedCode = input;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(
          () => error = e is FormatException ? e.message : friendlyError(e),
        );
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> scan() async {
    final value = await Navigator.of(
      context,
    ).push<String>(MaterialPageRoute(builder: (_) => const _ScanPass()));
    if (value != null && mounted) await verify(value);
  }

  Future<void> checkIn() async {
    if (busy || verifiedCode == null) return;
    setState(() => busy = true);
    try {
      final entry = await ref.read(visitorPassProvider).checkIn(verifiedCode!);
      await ref.read(appProvider.notifier).refreshServer();
      if (mounted) {
        showToast(context, 'Entry recorded. Welcome ${entry.name}.');
        context.go('/visitor/${entry.id}');
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          error = friendlyError(e);
          visitor = null;
        });
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => AppPage(
    maxWidth: 600,
    children: [
      TextButton.icon(
        onPressed: () => context.go('/'),
        icon: const Icon(Icons.arrow_back),
        label: const Text('Back to gate'),
      ),
      const PageHeading(
        'Verify a visitor pass',
        'Scan the QR or enter the code shared by the resident.',
      ),
      FilledButton.icon(
        key: const Key('open-scanner'),
        onPressed: busy ? null : scan,
        icon: const Icon(Icons.qr_code_scanner),
        label: const Text('Scan visitor QR'),
      ),
      const SizedBox(height: 22),
      Surface(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              key: const Key('pass-code-input'),
              controller: code,
              enabled: !busy,
              textCapitalization: TextCapitalization.characters,
              autocorrect: false,
              onChanged: (_) => setState(() {
                visitor = null;
                verifiedCode = null;
                error = null;
              }),
              onSubmitted: (_) => verify(),
              decoration: const InputDecoration(
                labelText: 'Visitor code',
                hintText: 'ABCD-EFGH-2345',
                prefixIcon: Icon(Icons.confirmation_number_outlined),
              ),
            ),
            const SizedBox(height: 14),
            OutlinedButton(
              key: const Key('verify-pass'),
              onPressed: busy ? null : () => verify(),
              child: const Text('Verify code'),
            ),
            if (error != null)
              Padding(
                padding: const EdgeInsets.only(top: 14),
                child: Text(
                  error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ),
          ],
        ),
      ),
      if (busy)
        const Padding(
          padding: EdgeInsets.all(20),
          child: Center(child: CircularProgressIndicator()),
        ),
      if (visitor case final entry?) ...[
        const SizedBox(height: 20),
        Surface(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Valid resident invitation',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 18),
              VisitorTile(
                entry,
                showUnit: true,
                onTap: () => context.push('/visitor/${entry.id}'),
              ),
              const SizedBox(height: 12),
              Text(
                'Phone: ${entry.phone}\nPeople: ${entry.people}${entry.vehicle.isNotEmpty ? '\nVehicle: ${entry.vehicle}' : ''}',
              ),
              const SizedBox(height: 16),
              const Text(
                'Check the visitor details before allowing entry. The pass will be used when you record entry.',
              ),
              const SizedBox(height: 16),
              FilledButton.icon(
                key: const Key('pass-check-in'),
                onPressed: busy ? null : checkIn,
                icon: const Icon(Icons.login),
                label: const Text('Record entry'),
              ),
            ],
          ),
        ),
      ],
    ],
  );
}

/// The camera exists only while this route is open; the plugin handles app pause/resume.
class _ScanPass extends StatefulWidget {
  const _ScanPass();
  @override
  State<_ScanPass> createState() => _ScanPassState();
}

class _ScanPassState extends State<_ScanPass> {
  bool captured = false;
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Scan visitor QR')),
    body: Column(
      children: [
        Expanded(
          child: MobileScanner(
            onDetect: (capture) {
              final value = capture.barcodes
                  .where((b) => b.rawValue != null)
                  .firstOrNull
                  ?.rawValue;
              if (!captured && value != null && mounted) {
                captured = true;
                Navigator.pop(context, value);
              }
            },
            errorBuilder: (_, error) => const Center(
              child: Padding(
                padding: EdgeInsets.all(28),
                child: Text(
                  'Camera unavailable. Allow camera access in settings, or go back and enter the visitor code.',
                  textAlign: TextAlign.center,
                ),
              ),
            ),
          ),
        ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: TextButton.icon(
              onPressed: () => Navigator.pop(context),
              icon: const Icon(Icons.keyboard),
              label: const Text('Enter code instead'),
            ),
          ),
        ),
      ],
    ),
  );
}
