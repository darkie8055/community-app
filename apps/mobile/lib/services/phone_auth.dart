import 'dart:async';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';

class PhoneAuth {
  String? verificationId;
  ConfirmationResult? confirmation;
  static Future<void> initialize() async {
    if (Firebase.apps.isNotEmpty) return;
    const key = String.fromEnvironment('FIREBASE_API_KEY');
    if (kIsWeb || key.isNotEmpty) {
      if (key.isEmpty) {
        throw StateError(
          'Set Firebase web options in the build configuration.',
        );
      }
      await Firebase.initializeApp(
        options: const FirebaseOptions(
          apiKey: key,
          appId: String.fromEnvironment('FIREBASE_APP_ID'),
          messagingSenderId: String.fromEnvironment('FIREBASE_SENDER_ID'),
          projectId: String.fromEnvironment('FIREBASE_PROJECT_ID'),
          authDomain: String.fromEnvironment('FIREBASE_AUTH_DOMAIN'),
        ),
      );
    } else {
      await Firebase.initializeApp();
    }
  }

  Future<bool> send(String phone) async {
    if (kIsWeb) {
      confirmation = await FirebaseAuth.instance.signInWithPhoneNumber(
        '+91$phone',
      );
      return false;
    }
    final result = Completer<bool>();
    await FirebaseAuth.instance.verifyPhoneNumber(
      phoneNumber: '+91$phone',
      timeout: const Duration(seconds: 60),
      verificationCompleted: (credential) async {
        try {
          await FirebaseAuth.instance.signInWithCredential(credential);
          if (!result.isCompleted) result.complete(true);
        } catch (e) {
          if (!result.isCompleted) result.completeError(e);
        }
      },
      verificationFailed: (error) {
        if (!result.isCompleted) result.completeError(error);
      },
      codeSent: (id, token) {
        verificationId = id;
        if (!result.isCompleted) result.complete(false);
      },
      codeAutoRetrievalTimeout: (id) {
        verificationId = id;
        if (!result.isCompleted) result.complete(false);
      },
    );
    return result.future;
  }

  Future<void> verify(String code) async {
    if (kIsWeb) {
      await confirmation!.confirm(code);
      return;
    }
    if (verificationId == null) {
      throw StateError('Request a verification code first.');
    }
    await FirebaseAuth.instance.signInWithCredential(
      PhoneAuthProvider.credential(
        verificationId: verificationId!,
        smsCode: code,
      ),
    );
  }
}
