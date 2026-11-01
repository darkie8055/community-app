import 'dart:convert';
import 'package:dio/dio.dart';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../domain/models.dart';
import 'theme.dart';

String friendlyError(Object error) {
  if (error is DioException) {
    final data = error.response?.data;
    if (data is Map && data['message'] != null) {
      final message = data['message'];
      return message is List ? message.join('. ') : message.toString();
    }
    return 'Could not reach your community. Please try again.';
  }
  return error.toString();
}

class Surface extends StatelessWidget {
  const Surface({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(22),
    this.color = Colors.white,
    this.borderColor = AppColors.line,
    this.radius = 18,
  });
  final Widget child;
  final EdgeInsetsGeometry padding;
  final Color color, borderColor;
  final double radius;
  @override
  Widget build(BuildContext context) => Container(
    padding: padding,
    decoration: BoxDecoration(
      color: color,
      borderRadius: BorderRadius.circular(radius),
      border: Border.all(color: borderColor),
    ),
    child: child,
  );
}

class SectionTitle extends StatelessWidget {
  const SectionTitle(
    this.title, {
    super.key,
    this.action,
    this.onTap,
    this.count,
  });
  final String title;
  final String? action;
  final VoidCallback? onTap;
  final int? count;
  @override
  Widget build(BuildContext context) => Row(
    children: [
      Expanded(
        child: Row(
          children: [
            Flexible(
              child: Text(
                title,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -.4,
                ),
              ),
            ),
            if (count != null) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.peach,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  '$count',
                  style: const TextStyle(
                    fontSize: 11,
                    color: AppColors.coral,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
      if (action != null)
        TextButton(
          onPressed: onTap,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(action!),
              const SizedBox(width: 4),
              const Icon(Icons.arrow_forward_rounded, size: 14),
            ],
          ),
        ),
    ],
  );
}

class StatusPill extends StatelessWidget {
  const StatusPill(this.status, {super.key});
  final VisitStatus status;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
    decoration: BoxDecoration(
      color: status.background,
      borderRadius: BorderRadius.circular(7),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 5,
          height: 5,
          decoration: BoxDecoration(
            color: status.color,
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: 5),
        Text(
          status.label,
          style: TextStyle(
            color: status.color,
            fontSize: 10,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    ),
  );
}

class VisitorAvatar extends StatelessWidget {
  const VisitorAvatar(this.visitor, {super.key, this.size = 46});
  final VisitorEntry visitor;
  final double size;
  @override
  Widget build(BuildContext context) {
    if (visitor.photoUrl != null) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(13),
        child: Image.network(
          visitor.photoUrl!,
          width: size,
          height: size,
          fit: BoxFit.cover,
          errorBuilder: (_, e, s) => _fallback(),
        ),
      );
    }
    if (visitor.photoBase64 != null) {
      try {
        return ClipRRect(
          borderRadius: BorderRadius.circular(13),
          child: Image.memory(
            base64Decode(visitor.photoBase64!),
            width: size,
            height: size,
            fit: BoxFit.cover,
            errorBuilder: (_, error, stack) => _fallback(),
          ),
        );
      } on FormatException {
        return _fallback();
      }
    }
    return _fallback();
  }

  Widget _fallback() => Container(
    width: size,
    height: size,
    decoration: BoxDecoration(
      color: visitor.type.color.withValues(alpha: .12),
      borderRadius: BorderRadius.circular(13),
    ),
    child: Icon(visitor.type.icon, size: size * .48, color: visitor.type.color),
  );
}

class VisitorTile extends StatelessWidget {
  const VisitorTile(
    this.visitor, {
    super.key,
    required this.onTap,
    this.showUnit = false,
    this.action,
  });
  final VisitorEntry visitor;
  final VoidCallback onTap;
  final bool showUnit;
  final Widget? action;
  @override
  Widget build(BuildContext context) => InkWell(
    borderRadius: BorderRadius.circular(12),
    onTap: onTap,
    child: Padding(
      padding: const EdgeInsets.symmetric(vertical: 13, horizontal: 2),
      child: Row(
        children: [
          VisitorAvatar(visitor),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  visitor.name,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: 5),
                Text(
                  '${visitor.description}${showUnit ? ' · ${visitor.unit}' : ''}',
                  style: const TextStyle(fontSize: 10, color: AppColors.muted),
                ),
              ],
            ),
          ),
          const SizedBox(width: 5),
          action ??
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  StatusPill(visitor.status),
                  const SizedBox(height: 5),
                  Text(
                    DateFormat('h:mm a').format(
                      (visitor.exitedAt ??
                              visitor.enteredAt ??
                              visitor.createdAt)
                          .toLocal(),
                    ),
                    style: const TextStyle(fontSize: 9, color: AppColors.muted),
                  ),
                ],
              ),
        ],
      ),
    ),
  );
}

class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.title,
    required this.message,
    this.icon = Icons.check_circle_outline_rounded,
    this.action,
  });
  final String title, message;
  final IconData icon;
  final Widget? action;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 20),
    child: Column(
      children: [
        Container(
          padding: const EdgeInsets.all(20),
          decoration: const BoxDecoration(
            color: AppColors.peach,
            shape: BoxShape.circle,
          ),
          child: Icon(icon, color: AppColors.coral, size: 32),
        ),
        const SizedBox(height: 18),
        Text(
          title,
          style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        Text(
          message,
          textAlign: TextAlign.center,
          style: const TextStyle(
            color: AppColors.muted,
            fontSize: 12,
            height: 1.7,
          ),
        ),
        if (action != null) ...[const SizedBox(height: 20), action!],
      ],
    ),
  );
}

class PageHeading extends StatelessWidget {
  const PageHeading(this.title, this.subtitle, {super.key, this.action});
  final String title, subtitle;
  final Widget? action;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 24),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -1.1,
                ),
              ),
              const SizedBox(height: 7),
              Text(
                subtitle,
                style: const TextStyle(
                  fontSize: 12,
                  color: AppColors.muted,
                  height: 1.6,
                ),
              ),
            ],
          ),
        ),
        ?action,
      ],
    ),
  );
}

class AppPage extends StatelessWidget {
  const AppPage({super.key, required this.children, this.maxWidth = 1200});
  final List<Widget> children;
  final double maxWidth;
  @override
  Widget build(BuildContext context) => SingleChildScrollView(
    child: Center(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth),
        child: Padding(
          padding: EdgeInsets.all(
            MediaQuery.sizeOf(context).width < 650 ? 20 : 32,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: children,
          ),
        ),
      ),
    ),
  );
}

void showToast(BuildContext context, String message) =>
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), duration: const Duration(seconds: 3)),
    );

class Label extends StatelessWidget {
  const Label(this.text, {super.key});
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 9, top: 20),
    child: Text(
      text,
      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
    ),
  );
}
