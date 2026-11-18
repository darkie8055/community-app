# Visitor QR passes

Updated 10 November 2026.

A resident opens an approved visit and generates a pass valid for 1 to 48 hours. They can copy the readable code, share text or export/share a PNG. Replacing a pass invalidates the old code. Revocation leaves the underlying visitor approval unchanged.

Guards scan or type a code, review the visitor/flat, then explicitly record entry. Camera denial has a manual-code fallback. The QR URI is also a registered native deep link. Guard builds defer verification until sign-in and approved society selection; verification never records entry automatically.

Migration `006_visitor_passes.sql` stores the tenant, entry, nonce, hashed code, expiry, creator and revocation. The 12-character code derives from HMAC and a per-pass nonce; plaintext codes are not stored. QR payloads contain only the version, society ID and code. Shared cards/text include the visit label, so share only with the intended visitor.

Only residents associated with an approved visit's unit issue/read/revoke passes. Authorized guards/administrators verify within their society. Invalid, expired, revoked, replaced, foreign-society and used passes are rejected. Rotating `JWT_SECRET` invalidates existing passes.

Check-in revalidates within the visit row-lock transaction using database time. Only one concurrent entry succeeds. Audit and notification outbox records follow the ordinary visitor flow. The pass does not replace identification at the gate.

- `GET /v1/communities/:community/visitor-entries/:entry/pass`
- `POST` that path with `{ "hours": 24 }` to create/replace
- `DELETE` that path to revoke
- `POST /v1/communities/:community/visitor-passes/verify` with a code
- `POST /v1/communities/:community/visitor-passes/check-in` with the same code

Guard endpoints are rate limited. Backend tests cover authorization, expiration, rotation, replacement, revocation and concurrency. React Native checks cover strict parsing, tenant state and visitor contracts; browser interaction checks exercise pass generation and explicit guard verification/check-in. Native camera/OS share-sheet behavior still needs a configured physical device. There is no local/offline issuer.
