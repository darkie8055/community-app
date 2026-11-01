import 'package:flutter/material.dart';

/// Original scalable artwork, drawn in Flutter so the app works offline.
class NeighbourhoodArt extends StatelessWidget {
  const NeighbourhoodArt({super.key});
  @override
  Widget build(BuildContext context) =>
      CustomPaint(painter: _NeighbourhoodPainter(), size: const Size(320, 210));
}

class _NeighbourhoodPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.scale(size.width / 320, size.height / 210);
    final paint = Paint();
    void rect(double x, double y, double w, double h, Color c, [double r = 0]) {
      paint.color = c;
      canvas.drawRRect(
        RRect.fromRectAndRadius(Rect.fromLTWH(x, y, w, h), Radius.circular(r)),
        paint,
      );
    }

    void circle(double x, double y, double r, Color c) {
      paint.color = c;
      canvas.drawCircle(Offset(x, y), r, paint);
    }

    circle(204, 91, 84, const Color(0xFFF5DDCA));
    circle(91, 45, 16, const Color(0xFFF2C7A6));
    rect(25, 184, 290, 8, const Color(0xFFE5C8B4), 4);
    rect(76, 67, 80, 118, const Color(0xFFF8F4ED), 3);
    rect(76, 67, 18, 118, const Color(0xFFE5D8C9));
    rect(70, 62, 92, 7, const Color(0xFF798E85), 2);
    rect(174, 41, 94, 144, const Color(0xFFF9F6EF), 3);
    rect(174, 41, 21, 144, const Color(0xFFE9DDCE));
    rect(168, 35, 106, 8, const Color(0xFF7D9588), 2);
    for (var row = 0; row < 4; row++) {
      for (var col = 0; col < 2; col++) {
        rect(
          105 + col * 25.0,
          83 + row * 23.0,
          13,
          14,
          const Color(0xFFB4C4BD),
          1,
        );
      }
      for (var col = 0; col < 3; col++) {
        rect(
          203 + col * 19.0,
          58 + row * 25.0,
          11,
          15,
          const Color(0xFFA8BAB0),
          1,
        );
      }
    }
    rect(116, 159, 16, 26, const Color(0xFF718D80), 1);
    rect(214, 160, 20, 25, const Color(0xFF718D80), 1);
    rect(144, 129, 49, 56, const Color(0xFFDBAF90), 2);
    rect(140, 124, 57, 7, const Color(0xFF668675), 2);
    rect(156, 144, 23, 41, const Color(0xFFF5E7D4), 11);
    for (final (x, y, s) in [
      (47.0, 142.0, 1.0),
      (290.0, 148.0, .85),
      (21.0, 164.0, .6),
    ]) {
      rect(x - 2, y, 4, 185 - y, const Color(0xFF897D65), 1);
      circle(x, y - 10 * s, 22 * s, const Color(0xFF8CA38A));
      circle(x - 5 * s, y - 17 * s, 16 * s, const Color(0xFF9FB39A));
    }
    rect(67, 176, 30, 10, const Color(0xFF8DAB8C), 6);
    rect(238, 178, 31, 8, const Color(0xFF8DAB8C), 6);
    circle(140, 166, 4, const Color(0xFF966C56));
    rect(137, 170, 6, 11, const Color(0xFFE78061), 3);
    rect(137, 179, 2, 7, const Color(0xFF56685D));
    rect(141, 179, 2, 7, const Color(0xFF56685D));
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
