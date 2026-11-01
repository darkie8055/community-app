class VisitorPass {
  const VisitorPass({
    required this.entryId,
    required this.communityId,
    required this.code,
    required this.expiresAt,
  });
  final String entryId, communityId, code;
  final DateTime expiresAt;
  bool get expired => !expiresAt.isAfter(DateTime.now().toUtc());
  String get formattedCode =>
      '${code.substring(0, 4)}-${code.substring(4, 8)}-${code.substring(8)}';
  String get payload => Uri(
    scheme: 'mycommunity',
    host: 'pass',
    path: '/v1',
    queryParameters: {'community': communityId, 'code': code},
  ).toString();
  Map<String, dynamic> toJson() => {
    'entry_id': entryId,
    'community_id': communityId,
    'code': code,
    'expires_at': expiresAt.toUtc().toIso8601String(),
  };
  factory VisitorPass.fromJson(Map<String, dynamic> json) => VisitorPass(
    entryId: json['entry_id'],
    communityId: json['community_id'],
    code: json['code'],
    expiresAt: DateTime.parse(json['expires_at']).toUtc(),
  );

  /// Only our pass format or a plain human-readable code is accepted.
  static String parseCode(String input, String community) {
    var text = input.trim();
    if (text.contains('://')) {
      final uri = Uri.tryParse(text);
      if (uri == null ||
          uri.scheme != 'mycommunity' ||
          uri.host != 'pass' ||
          uri.path != '/v1' ||
          uri.hasFragment ||
          uri.userInfo.isNotEmpty ||
          uri.hasPort ||
          uri.queryParametersAll['code']?.length != 1 ||
          uri.queryParametersAll['community']?.length != 1) {
        throw const FormatException(
          'This is not a MyCommunity visitor QR code.',
        );
      }
      if (uri.queryParameters['community'] != community) {
        throw const FormatException(
          'This pass belongs to a different society.',
        );
      }
      text = uri.queryParameters['code']!;
    }
    final code = text.replaceAll(RegExp(r'[\s-]'), '').toUpperCase();
    if (!RegExp(r'^[2-9A-HJ-NP-Z]{12}$').hasMatch(code)) {
      throw const FormatException(
        'Enter the 12-character code printed below the QR.',
      );
    }
    return code;
  }
}
