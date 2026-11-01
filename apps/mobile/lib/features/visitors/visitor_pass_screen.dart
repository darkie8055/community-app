import 'dart:async';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:share_plus/share_plus.dart';
import '../../domain/models.dart';
import '../../domain/visitor_pass.dart';
import '../../services/visitor_pass_repository.dart';
import '../../state/app_state.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';

class VisitorPassScreen extends ConsumerStatefulWidget {
  const VisitorPassScreen({super.key, required this.id});
  final String id;
  @override
  ConsumerState<VisitorPassScreen> createState() => _VisitorPassScreenState();
}

class _VisitorPassScreenState extends ConsumerState<VisitorPassScreen> {
  final card = GlobalKey();
  VisitorPass? pass;
  VisitorEntry? entry;
  String? error;
  bool busy = true;
  int hours = 24;
  Timer? timer;
  @override
  void initState() {
    super.initState();
    load();
    timer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    timer?.cancel();
    super.dispose();
  }

  Future<void> load() async {
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final repo = ref.read(visitorPassProvider);
      final visit = await repo.entry(widget.id);
      final current = await repo.get(widget.id);
      if (mounted) {
        setState(() {
          entry = visit;
          pass = current;
        });
      }
    } catch (e) {
      if (mounted) setState(() => error = friendlyError(e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<bool> confirm(String title, String message) async =>
      await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Text(title),
          content: Text(message),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Continue'),
            ),
          ],
        ),
      ) ??
      false;

  Future<void> generate() async {
    if (pass != null &&
        !pass!.expired &&
        !await confirm(
          'Replace this pass?',
          'The previous QR and code will stop working. Share the new pass with your visitor.',
        )) {
      return;
    }
    if (!mounted) return;
    setState(() => busy = true);
    try {
      final next = await ref.read(visitorPassProvider).create(widget.id, hours);
      if (mounted) {
        setState(() {
          pass = next;
          error = null;
        });
      }
    } catch (e) {
      if (mounted) showToast(context, friendlyError(e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> revoke() async {
    if (!await confirm(
      'Revoke this pass?',
      'This QR and code will no longer work. The visitor approval stays in the visitor book.',
    )) {
      return;
    }
    if (!mounted) return;
    setState(() => busy = true);
    try {
      await ref.read(visitorPassProvider).revoke(widget.id);
      if (mounted) {
        setState(() => pass = null);
        showToast(context, 'Visitor pass revoked.');
      }
    } catch (e) {
      if (mounted) showToast(context, friendlyError(e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> share(bool withImage) async {
    final current = pass;
    if (current == null || current.expired) return;
    final box = context.findRenderObject() as RenderBox?;
    final origin = box == null
        ? null
        : box.localToGlobal(Offset.zero) & box.size;
    final society = ref.read(backendProvider)?.communityName ?? 'Palm Meadows';
    final text =
        'Visitor pass for ${entry!.name}\n$society · ${entry!.unit}\n'
        'Code: ${current.formattedCode}\nValid until ${DateFormat('d MMM yyyy, h:mm a').format(current.expiresAt.toLocal())} '
        '(${current.expiresAt.toLocal().timeZoneName})\nShow this pass at the gate. Valid for one entry.';
    setState(() => busy = true);
    try {
      List<XFile>? files;
      if (withImage) {
        await WidgetsBinding.instance.endOfFrame;
        final boundary =
            card.currentContext!.findRenderObject() as RenderRepaintBoundary;
        final bitmap = await boundary.toImage(pixelRatio: 3);
        try {
          final data = await bitmap.toByteData(format: ui.ImageByteFormat.png);
          if (data == null) {
            throw StateError(
              'Could not create the QR image. Try sharing the code.',
            );
          }
          files = [
            XFile.fromData(data.buffer.asUint8List(), mimeType: 'image/png'),
          ];
        } finally {
          bitmap.dispose();
        }
      }
      await SharePlus.instance.share(
        ShareParams(
          title: 'MyCommunity visitor pass',
          text: text,
          files: files,
          fileNameOverrides: withImage
              ? ['MyCommunity-visitor-pass.png']
              : null,
          sharePositionOrigin: origin,
        ),
      );
    } catch (e) {
      if (mounted) {
        showToast(context, 'Sharing unavailable. Use Copy code or try again.');
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final current = pass;
    final stateEntry = ref
        .watch(appProvider)
        .entries
        .where((e) => e.id == widget.id)
        .firstOrNull;
    final approved = (stateEntry ?? entry)?.status == VisitStatus.approved;
    final usable = current != null && !current.expired && approved;
    return AppPage(
      maxWidth: 580,
      children: [
        TextButton.icon(
          onPressed: () => context.go('/visitor/${widget.id}'),
          icon: const Icon(Icons.arrow_back),
          label: const Text('Back to visitor'),
        ),
        const PageHeading(
          'A welcome, ready to share',
          'One visitor pass. A smoother arrival.',
        ),
        if (error != null)
          EmptyState(
            title: 'Pass unavailable',
            message: error!,
            action: TextButton(onPressed: load, child: const Text('Retry')),
          )
        else if (entry == null)
          const Center(child: CircularProgressIndicator())
        else ...[
          if (usable)
            Center(
              child: RepaintBoundary(
                key: card,
                child: Container(
                  width: 390,
                  padding: const EdgeInsets.all(24),
                  color: Colors.white,
                  child: Column(
                    children: [
                      const Icon(
                        Icons.shield_outlined,
                        color: AppColors.ink,
                        size: 30,
                      ),
                      const SizedBox(height: 10),
                      const Text(
                        'MYCOMMUNITY · VISITOR PASS',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 1,
                        ),
                      ),
                      const SizedBox(height: 18),
                      Text(
                        entry!.name,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      Text(
                        '${entry!.unit} · ${ref.read(backendProvider)?.communityName ?? 'Palm Meadows'}',
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 16),
                      QrImageView(
                        key: const Key('visitor-qr'),
                        data: current.payload,
                        size: 230,
                        padding: const EdgeInsets.all(16),
                        backgroundColor: Colors.white,
                        errorCorrectionLevel: QrErrorCorrectLevel.M,
                        semanticsLabel: 'Visitor pass QR code',
                      ),
                      const SizedBox(height: 12),
                      SelectableText(
                        current.formattedCode,
                        key: const Key('visitor-pass-code'),
                        style: const TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 1.5,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'Valid until ${DateFormat('d MMM, h:mm a').format(current.expiresAt.toLocal())}',
                        textAlign: TextAlign.center,
                        style: const TextStyle(fontSize: 12),
                      ),
                      const SizedBox(height: 6),
                      const Text(
                        'Show at the gate · One entry only',
                        style: TextStyle(fontSize: 11, color: AppColors.muted),
                      ),
                    ],
                  ),
                ),
              ),
            )
          else
            Surface(
              child: Column(
                children: [
                  const Icon(
                    Icons.qr_code_2_rounded,
                    size: 64,
                    color: AppColors.ink,
                  ),
                  const SizedBox(height: 16),
                  Text(
                    !approved
                        ? 'This visit is no longer awaiting entry.'
                        : current?.expired == true
                        ? 'This pass has expired.'
                        : 'Create a visitor pass',
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 10),
                  const Text(
                    'Your guest can show a QR or give the code to security. Share it only with your visitor.',
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          const SizedBox(height: 20),
          if (usable) ...[
            FilledButton.icon(
              key: const Key('share-qr'),
              onPressed: busy ? null : () => share(true),
              icon: const Icon(Icons.ios_share),
              label: const Text('Share QR image'),
            ),
            const SizedBox(height: 10),
            Wrap(
              alignment: WrapAlignment.center,
              spacing: 12,
              runSpacing: 8,
              children: [
                OutlinedButton.icon(
                  onPressed: busy ? null : () => share(false),
                  icon: const Icon(Icons.share_outlined),
                  label: const Text('Share code'),
                ),
                OutlinedButton.icon(
                  key: const Key('copy-pass'),
                  onPressed: busy
                      ? null
                      : () async {
                          await Clipboard.setData(
                            ClipboardData(text: current.formattedCode),
                          );
                          if (context.mounted) {
                            showToast(context, 'Visitor code copied.');
                          }
                        },
                  icon: const Icon(Icons.copy),
                  label: const Text('Copy code'),
                ),
              ],
            ),
            const SizedBox(height: 20),
          ],
          if (approved)
            Surface(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    'Pass validity',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                  DropdownButton<int>(
                    value: hours,
                    isExpanded: true,
                    onChanged: busy ? null : (v) => setState(() => hours = v!),
                    items: [1, 6, 24, 48]
                        .map(
                          (h) => DropdownMenuItem(
                            value: h,
                            child: Text('$h ${h == 1 ? 'hour' : 'hours'}'),
                          ),
                        )
                        .toList(),
                  ),
                  OutlinedButton.icon(
                    key: const Key('generate-pass'),
                    onPressed: busy ? null : generate,
                    icon: const Icon(Icons.qr_code),
                    label: Text(
                      usable ? 'Generate new pass' : 'Generate QR & code',
                    ),
                  ),
                  if (usable)
                    TextButton(
                      onPressed: busy ? null : revoke,
                      child: const Text('Revoke pass'),
                    ),
                ],
              ),
            ),
          if (busy)
            const Padding(
              padding: EdgeInsets.all(12),
              child: Center(child: CircularProgressIndicator()),
            ),
        ],
      ],
    );
  }
}
