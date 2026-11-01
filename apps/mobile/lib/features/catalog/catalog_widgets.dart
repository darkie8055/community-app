import 'package:flutter/material.dart';
import 'dart:convert';
import 'package:intl/intl.dart';
import '../../ui/theme.dart';

String money(dynamic price) => price == 0
    ? 'FREE'
    : '₹ ${NumberFormat.decimalPattern('en_IN').format(price ?? 0)}';
const categories = [
  'Furniture',
  'Food',
  'Services',
  'Home Decor',
  'Electronics',
  'Vehicles',
  'Kids Items',
  'Others',
  'Free',
];
const categoryIcons = [
  Icons.chair_outlined,
  Icons.cake_outlined,
  Icons.handyman_outlined,
  Icons.light_outlined,
  Icons.local_laundry_service_outlined,
  Icons.directions_car_outlined,
  Icons.toys_outlined,
  Icons.menu_book_outlined,
  Icons.volunteer_activism_outlined,
];
const serviceCategories = [
  'Cleaning',
  'Appliance Repair',
  'Moving',
  'Painting',
];

class ItemPhoto extends StatelessWidget {
  const ItemPhoto(this.item, {super.key, this.height = 170});
  final Map<String, dynamic> item;
  final double height;
  @override
  Widget build(BuildContext context) {
    if (item['photo_base64'] != null) {
      return Image.memory(
        base64Decode(item['photo_base64']),
        height: height,
        width: double.infinity,
        fit: BoxFit.cover,
      );
    }
    if (item['photo_url'] != null) {
      return Image.network(
        item['photo_url'],
        height: height,
        width: double.infinity,
        fit: BoxFit.cover,
        errorBuilder: (_, e, s) =>
            const Center(child: Icon(Icons.broken_image_outlined)),
      );
    }
    final asset = item['image_asset'] ?? 'community';
    final file = asset == 'house' || asset == 'community'
        ? 'community.jpg'
        : '$asset.jpg';
    return Image.asset(
      'assets/images/$file',
      height: height,
      width: double.infinity,
      fit: BoxFit.cover,
      errorBuilder: (_, e, s) => Container(
        height: height,
        color: const Color(0xFFDDE8E3),
        alignment: Alignment.center,
        child: Icon(
          asset == 'chair'
              ? Icons.chair_outlined
              : asset == 'moving'
              ? Icons.local_shipping_outlined
              : Icons.home_work_outlined,
          size: 64,
          color: AppColors.coral,
        ),
      ),
    );
  }
}

Future<String?> askMessage(
  BuildContext context,
  String title, {
  String hint = 'Write your message',
}) => showDialog<String>(
  context: context,
  builder: (_) => _MessageDialog(title: title, hint: hint),
);

class _MessageDialog extends StatefulWidget {
  const _MessageDialog({required this.title, required this.hint});
  final String title, hint;
  @override
  State<_MessageDialog> createState() => _MessageDialogState();
}

class _MessageDialogState extends State<_MessageDialog> {
  final controller = TextEditingController();
  final form = GlobalKey<FormState>();
  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text(widget.title),
    content: Form(
      key: form,
      child: TextFormField(
        controller: controller,
        autofocus: true,
        maxLines: 4,
        maxLength: 1000,
        decoration: InputDecoration(hintText: widget.hint),
        validator: (v) =>
            (v?.trim().length ?? 0) < 2 ? 'Please enter a message' : null,
      ),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: const Text('Cancel'),
      ),
      FilledButton(
        onPressed: () {
          if (form.currentState!.validate()) {
            Navigator.pop(context, controller.text.trim());
          }
        },
        child: const Text('Send'),
      ),
    ],
  );
}
