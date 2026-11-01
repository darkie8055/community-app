import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../data/demo_repository.dart';
import '../../domain/models.dart';
import '../../state/app_state.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';

class VisitorForm extends ConsumerStatefulWidget {
  const VisitorForm({super.key, required this.role, this.preapproved = false});
  final AppRole role;
  final bool preapproved;
  @override
  ConsumerState<VisitorForm> createState() => _VisitorFormState();
}

class _VisitorFormState extends ConsumerState<VisitorForm> {
  final form = GlobalKey<FormState>();
  final name = TextEditingController();
  final phone = TextEditingController();
  final company = TextEditingController();
  final purpose = TextEditingController();
  final vehicle = TextEditingController();
  VisitType type = VisitType.guest;
  String unit = 'A-1204';
  int people = 1;
  String? photo;
  bool saving = false;
  String? previousIntent, requestKey;
  @override
  void initState() {
    super.initState();
    final backend = ref.read(backendProvider);
    if (backend != null) {
      unit =
          (widget.preapproved ? backend.ownUnits : backend.units)
              .keys
              .firstOrNull ??
          '';
    }
  }

  @override
  void dispose() {
    for (final c in [name, phone, company, purpose, vehicle]) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if ((widget.preapproved && widget.role != AppRole.resident) ||
        (!widget.preapproved && widget.role != AppRole.guard)) {
      return const AppPage(
        children: [
          EmptyState(
            title: 'Choose the right workspace',
            message:
                'Residents can invite guests. Security can register arrivals.',
          ),
        ],
      );
    }
    return AppPage(
      maxWidth: 760,
      children: [
        TextButton.icon(
          onPressed: () => context.go('/'),
          icon: const Icon(Icons.arrow_back_rounded, size: 17),
          label: const Text('Back to home'),
        ),
        const SizedBox(height: 14),
        PageHeading(
          widget.preapproved
              ? 'Good company starts with an invite.'
              : 'Welcome a new visitor',
          widget.preapproved
              ? 'Pre-approve your visitor for a smoother arrival.'
              : 'A few details, and we’ll let the resident know.',
        ),
        Surface(
          child: Form(
            key: form,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'VISITOR TYPE',
                  style: TextStyle(
                    fontSize: 9,
                    letterSpacing: 1.2,
                    color: AppColors.muted,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 15),
                Row(
                  children: [
                    for (final t in VisitType.values)
                      Expanded(
                        child: Padding(
                          padding: EdgeInsets.only(
                            right: t == VisitType.service ? 0 : 8,
                          ),
                          child: InkWell(
                            onTap: () => setState(() => type = t),
                            borderRadius: BorderRadius.circular(12),
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              decoration: BoxDecoration(
                                color: type == t
                                    ? AppColors.peach
                                    : AppColors.canvas,
                                border: Border.all(
                                  color: type == t
                                      ? AppColors.coral
                                      : AppColors.line,
                                ),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Column(
                                children: [
                                  Icon(
                                    t.icon,
                                    size: 23,
                                    color: type == t
                                        ? AppColors.coral
                                        : AppColors.muted,
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    t.label,
                                    style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w700,
                                      color: type == t
                                          ? AppColors.coral
                                          : AppColors.muted,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
                const Label('Full name'),
                TextFormField(
                  key: const Key('visitor-name'),
                  controller: name,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(
                    hintText: 'e.g. Ananya Sharma',
                  ),
                  validator: (v) => (v?.trim().length ?? 0) < 2
                      ? 'Enter the visitor’s full name'
                      : null,
                ),
                const Label('Mobile number'),
                TextFormField(
                  key: const Key('visitor-phone'),
                  controller: phone,
                  keyboardType: TextInputType.phone,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(10),
                  ],
                  decoration: const InputDecoration(
                    hintText: '10-digit mobile number',
                    prefixText: '+91  ',
                  ),
                  validator: (v) => RegExp(r'^[6-9]\d{9}$').hasMatch(v ?? '')
                      ? null
                      : 'Enter a valid 10-digit Indian mobile number',
                ),
                if (type != VisitType.guest) ...[
                  const Label('Company / service'),
                  TextFormField(
                    controller: company,
                    decoration: const InputDecoration(
                      hintText: 'e.g. Amazon, Uber or Urban Company',
                    ),
                  ),
                ],
                const Label('Visiting flat'),
                DropdownButtonFormField<String>(
                  key: const Key('visitor-unit'),
                  initialValue: unit,
                  items:
                      (widget.preapproved
                              ? (ref
                                        .read(backendProvider)
                                        ?.ownUnits
                                        .keys
                                        .toList() ??
                                    ['A-1204'])
                              : ref.read(backendProvider)?.units.keys ??
                                    demoUnitIds.keys)
                          .map(
                            (u) => DropdownMenuItem(
                              value: u,
                              child: Text(
                                '$u · ${ref.read(backendProvider)?.communityName ?? 'Palm Meadows'}',
                                style: const TextStyle(fontSize: 13),
                              ),
                            ),
                          )
                          .toList(),
                  onChanged: (v) => setState(() => unit = v!),
                ),
                const Label('Purpose of visit'),
                TextFormField(
                  controller: purpose,
                  decoration: InputDecoration(
                    hintText: type == VisitType.guest
                        ? 'Personal visit'
                        : type.label,
                  ),
                ),
                const Label('Number of people'),
                Row(
                  children: [
                    IconButton.filledTonal(
                      tooltip: 'Fewer people',
                      onPressed: people > 1
                          ? () => setState(() => people--)
                          : null,
                      icon: const Icon(Icons.remove_rounded),
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      child: Text(
                        '$people',
                        style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 18,
                        ),
                      ),
                    ),
                    IconButton.filledTonal(
                      tooltip: 'More people',
                      onPressed: people < 20
                          ? () => setState(() => people++)
                          : null,
                      icon: const Icon(Icons.add_rounded),
                    ),
                  ],
                ),
                const Label('Vehicle number (optional)'),
                TextFormField(
                  controller: vehicle,
                  textCapitalization: TextCapitalization.characters,
                  decoration: const InputDecoration(
                    hintText: 'e.g. KA 01 AB 1234',
                  ),
                ),
                const Label('Visitor photo (optional)'),
                InkWell(
                  onTap: _pickPhoto,
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      border: Border.all(color: AppColors.line),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        if (photo != null)
                          ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: Image.memory(
                              base64Decode(photo!),
                              width: 48,
                              height: 48,
                              fit: BoxFit.cover,
                            ),
                          )
                        else
                          const Icon(
                            Icons.add_a_photo_outlined,
                            color: AppColors.muted,
                            size: 27,
                          ),
                        const SizedBox(width: 15),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                photo != null
                                    ? 'Photo added · Tap to change'
                                    : kIsWeb
                                    ? 'Choose a visitor photo'
                                    : 'Take a visitor photo',
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              const SizedBox(height: 5),
                              const Text(
                                'Ask the visitor before taking their photo.',
                                style: TextStyle(
                                  fontSize: 10,
                                  color: AppColors.muted,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                if (photo != null)
                  TextButton.icon(
                    onPressed: () => setState(() => photo = null),
                    icon: const Icon(Icons.close_rounded, size: 16),
                    label: const Text('Remove photo'),
                  ),
                const SizedBox(height: 26),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    key: const Key('submit-visitor'),
                    onPressed: saving ? null : _submit,
                    icon: saving
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : Icon(
                            widget.preapproved
                                ? Icons.check_circle_outline_rounded
                                : Icons.notifications_active_outlined,
                            size: 18,
                          ),
                    label: Text(
                      saving
                          ? 'Saving…'
                          : widget.preapproved
                          ? 'Pre-approve visitor'
                          : 'Send approval request',
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  widget.preapproved
                      ? 'The security team will see this approval when your visitor arrives.'
                      : 'The visitor must wait for resident approval before entering.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 10,
                    color: AppColors.muted,
                    height: 1.7,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Future<void> _pickPhoto() async {
    try {
      final image = await ImagePicker().pickImage(
        source: kIsWeb ? ImageSource.gallery : ImageSource.camera,
        maxWidth: 640,
        maxHeight: 640,
        imageQuality: 75,
      );
      if (image == null) return;
      final bytes = await image.readAsBytes();
      if (bytes.length > 2 * 1024 * 1024) {
        if (mounted) {
          showToast(context, 'Please choose a photo smaller than 2 MB.');
        }
        return;
      }
      if (mounted) setState(() => photo = base64Encode(bytes));
    } catch (_) {
      if (mounted) {
        showToast(
          context,
          'Photo unavailable. You can continue without a photo.',
        );
      }
    }
  }

  Future<void> _submit() async {
    if (saving) return;
    if (!form.currentState!.validate()) return;
    final intent = jsonEncode([
      name.text.trim(),
      phone.text,
      type.name,
      unit,
      company.text,
      purpose.text,
      people,
      vehicle.text,
      photo,
      widget.preapproved,
    ]);
    if (intent != previousIntent) {
      previousIntent = intent;
      requestKey = DemoRepository.uuid.v4();
    }
    setState(() => saving = true);
    try {
      final entry = await ref
          .read(appProvider.notifier)
          .registerVisitor(
            name: name.text,
            phone: phone.text,
            type: type,
            unit: unit,
            company: company.text,
            purpose: purpose.text,
            people: people,
            vehicle: vehicle.text,
            photoBase64: photo,
            requestKey: requestKey,
            preapproved: widget.preapproved,
          );
      if (mounted) {
        showToast(
          context,
          widget.preapproved
              ? 'Visitor pre-approved. You’re ready to welcome them.'
              : 'Approval request created. Waiting for the resident.',
        );
        context.go('/visitor/${entry.id}');
      }
    } catch (e) {
      if (mounted) showToast(context, friendlyError(e));
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }
}
