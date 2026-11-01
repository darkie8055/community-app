import 'dart:convert';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../services/content_repository.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import 'catalog_widgets.dart';

class NewItemScreen extends ConsumerStatefulWidget {
  const NewItemScreen({super.key, required this.kind});
  final String kind;
  @override
  ConsumerState<NewItemScreen> createState() => _NewItemScreenState();
}

class _NewItemScreenState extends ConsumerState<NewItemScreen> {
  final form = GlobalKey<FormState>();
  final title = TextEditingController(),
      description = TextEditingController(),
      price = TextEditingController(text: '0');
  String category = 'Furniture', listingType = 'rent', asset = 'chair';
  String? unit;
  DateTime? date;
  int bedrooms = 2;
  bool busy = false, preview = false;
  String? photo;
  @override
  void initState() {
    super.initState();
    if (widget.kind == 'property') {
      category = 'Rent';
      asset = 'house';
    }
    if (widget.kind == 'post') {
      category = 'Community';
      asset = 'community';
    }
    unit = ref.read(contentRepositoryProvider).homes.values.firstOrNull;
  }

  @override
  void dispose() {
    title.dispose();
    description.dispose();
    price.dispose();
    super.dispose();
  }

  Future<void> save(bool draft) async {
    if (!form.currentState!.validate()) return;
    if (widget.kind == 'property' && (date == null || unit == null)) {
      showToast(context, 'Select your property and available date.');
      return;
    }
    setState(() => busy = true);
    try {
      await ref.read(contentRepositoryProvider).create({
        'kind': widget.kind,
        'title': title.text.trim(),
        'description': description.text.trim(),
        'price': int.tryParse(price.text) ?? 0,
        'category': widget.kind == 'property'
            ? (listingType == 'rent' ? 'Rent' : 'Buy')
            : category,
        'image_asset': asset,
        'photo_base64': ?photo,
        'status': draft ? 'draft' : 'published',
        if (widget.kind == 'property') ...{
          'unit_id': unit,
          'listing_type': listingType,
          'bedrooms': bedrooms,
          'available_on': DateFormat('yyyy-MM-dd').format(date!),
        },
      });
      if (mounted) {
        showToast(
          context,
          draft
              ? 'Draft saved. Find it in My listings.'
              : 'Your post is published.',
        );
        context.pop();
      }
    } catch (e) {
      if (mounted) showToast(context, friendlyError(e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => AppPage(
    maxWidth: 700,
    children: [
      TextButton.icon(
        onPressed: () => context.pop(),
        icon: const Icon(Icons.arrow_back),
        label: const Text('Back'),
      ),
      PageHeading(
        widget.kind == 'property'
            ? 'Post your property'
            : widget.kind == 'post'
            ? 'New community post'
            : 'New listing',
        'A little detail helps your neighbours find what they need.',
      ),
      if (widget.kind == 'property')
        const Padding(
          padding: EdgeInsets.only(bottom: 18),
          child: Surface(
            color: Color(0xFFE6F2FD),
            child: Row(
              children: [
                Icon(Icons.info_outline, color: Color(0xFF287B9B)),
                SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Only properties linked to your approved owner membership can be listed.',
                  ),
                ),
              ],
            ),
          ),
        ),
      Surface(
        child: Form(
          key: form,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (widget.kind == 'property') ...[
                const Label('Select the property'),
                DropdownButtonFormField<String>(
                  initialValue: unit,
                  items: ref
                      .read(contentRepositoryProvider)
                      .homes
                      .entries
                      .map(
                        (e) => DropdownMenuItem(
                          value: e.value,
                          child: Text(e.key),
                        ),
                      )
                      .toList(),
                  onChanged: (v) => setState(() => unit = v),
                  validator: (v) =>
                      v == null ? 'An approved home is required' : null,
                ),
                const Label('Listing type'),
                SegmentedButton<String>(
                  segments: const [
                    ButtonSegment(value: 'rent', label: Text('Rent out')),
                    ButtonSegment(value: 'sell', label: Text('Sell')),
                  ],
                  selected: {listingType},
                  onSelectionChanged: (v) =>
                      setState(() => listingType = v.first),
                ),
                const Label('Available from'),
                OutlinedButton.icon(
                  onPressed: () async {
                    final value = await showDatePicker(
                      context: context,
                      initialDate: DateTime.now(),
                      firstDate: DateTime.now(),
                      lastDate: DateTime.now().add(const Duration(days: 730)),
                    );
                    if (value != null) setState(() => date = value);
                  },
                  icon: const Icon(Icons.calendar_today_outlined),
                  label: Text(
                    date == null
                        ? 'Select move-in date'
                        : DateFormat.yMMMd().format(date!),
                  ),
                ),
                const Label('Bedrooms'),
                DropdownButtonFormField<int>(
                  initialValue: bedrooms,
                  items: [
                    for (var n = 1; n <= 6; n++)
                      DropdownMenuItem(value: n, child: Text('$n BHK')),
                  ],
                  onChanged: (v) => bedrooms = v!,
                ),
              ],
              const Label('Title'),
              TextFormField(
                controller: title,
                maxLength: 120,
                decoration: const InputDecoration(
                  hintText: 'Give your post a clear title',
                ),
                validator: (v) => (v?.trim().length ?? 0) < 3
                    ? 'Enter at least 3 characters'
                    : null,
              ),
              const Label('Description'),
              TextFormField(
                controller: description,
                maxLines: 5,
                maxLength: 3000,
                decoration: const InputDecoration(
                  hintText: 'Condition, features, location and anything useful',
                ),
                validator: (v) => (v?.trim().length ?? 0) < 3
                    ? 'Add a short description'
                    : null,
              ),
              if (widget.kind != 'post') ...[
                const Label('Price in rupees (0 for free)'),
                TextFormField(
                  controller: price,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(prefixText: '₹ '),
                  validator: (v) {
                    final n = int.tryParse(v ?? '');
                    return n == null || n < 0 || n > 2000000000
                        ? 'Enter a valid whole-rupee price'
                        : null;
                  },
                ),
                if (widget.kind == 'listing') ...[
                  const Label('Category'),
                  DropdownButtonFormField<String>(
                    initialValue: category,
                    items: categories
                        .map((c) => DropdownMenuItem(value: c, child: Text(c)))
                        .toList(),
                    onChanged: (v) => category = v!,
                  ),
                ],
                const Label('Cover image'),
                OutlinedButton.icon(
                  onPressed: () async {
                    try {
                      final selected = await ImagePicker().pickImage(
                        source: ImageSource.gallery,
                        imageQuality: 80,
                        maxWidth: 1400,
                      );
                      if (selected == null) return;
                      final bytes = await selected.readAsBytes();
                      if (bytes.length > 2 * 1024 * 1024) {
                        throw StateError('Choose a photo smaller than 2 MB.');
                      }
                      if (mounted) setState(() => photo = base64Encode(bytes));
                    } catch (e) {
                      if (context.mounted) showToast(context, friendlyError(e));
                    }
                  },
                  icon: const Icon(Icons.add_photo_alternate_outlined),
                  label: Text(
                    photo == null ? 'Upload your photo' : 'Replace photo',
                  ),
                ),
                if (photo != null) ...[
                  const SizedBox(height: 12),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(15),
                    child: Image.memory(
                      base64Decode(photo!),
                      height: 180,
                      width: double.infinity,
                      fit: BoxFit.cover,
                    ),
                  ),
                  TextButton(
                    onPressed: () => setState(() => photo = null),
                    child: const Text('Remove photo'),
                  ),
                ],
                DropdownButtonFormField<String>(
                  initialValue: asset,
                  items:
                      [
                            'house',
                            'chair',
                            'sofa',
                            'car',
                            'decor',
                            'bicycle',
                            'community',
                          ]
                          .map(
                            (a) => DropdownMenuItem(
                              value: a,
                              child: Text(a[0].toUpperCase() + a.substring(1)),
                            ),
                          )
                          .toList(),
                  onChanged: (v) => setState(() => asset = v!),
                ),
                const Padding(
                  padding: EdgeInsets.only(top: 8),
                  child: Text(
                    'Choose an illustrative cover for your listing.',
                    style: TextStyle(color: AppColors.muted, fontSize: 11),
                  ),
                ),
              ],
              const SizedBox(height: 24),
              if (preview) ...[
                ClipRRect(
                  borderRadius: BorderRadius.circular(18),
                  child: ItemPhoto({
                    'image_asset': asset,
                    'photo_base64': photo,
                  }),
                ),
                const SizedBox(height: 12),
                Text(
                  title.text,
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                Text(description.text),
                const SizedBox(height: 20),
              ],
              Wrap(
                spacing: 12,
                runSpacing: 12,
                children: [
                  OutlinedButton(
                    onPressed: busy ? null : () => save(true),
                    child: const Text('Save draft'),
                  ),
                  OutlinedButton(
                    onPressed: () {
                      if (form.currentState!.validate()) {
                        setState(() => preview = !preview);
                      }
                    },
                    child: Text(preview ? 'Hide preview' : 'Preview'),
                  ),
                  FilledButton(
                    onPressed: busy ? null : () => save(false),
                    child: Text(busy ? 'Saving…' : 'Publish'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
      const SizedBox(height: 30),
    ],
  );
}
