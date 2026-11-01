import {
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { createRemoteJWKSet, jwtVerify } from "jose";
const keys = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
  ),
);
export async function verifyFirebaseIdentity(token: string) {
  const project = process.env.FIREBASE_PROJECT_ID;
  if (!project)
    throw new ServiceUnavailableException("Phone sign-in is not configured.");
  try {
    const { payload } = await jwtVerify(token, keys, {
      algorithms: ["RS256"],
      issuer: `https://securetoken.google.com/${project}`,
      audience: project,
      requiredClaims: ["sub", "iat", "exp", "auth_time"],
    });
    const firebase = payload.firebase as
      { sign_in_provider?: string } | undefined;
    if (
      !payload.sub ||
      payload.sub.length > 128 ||
      typeof payload.auth_time !== "number" ||
      payload.auth_time > Date.now() / 1000 ||
      typeof payload.iat !== "number" ||
      payload.iat > Date.now() / 1000 ||
      firebase?.sign_in_provider !== "phone" ||
      typeof payload.phone_number !== "string" ||
      !/^\+91[6-9]\d{9}$/.test(payload.phone_number)
    )
      throw new Error("Invalid phone identity");
    return { uid: payload.sub, phone: payload.phone_number.slice(3) };
  } catch {
    throw new UnauthorizedException(
      "Phone verification has expired. Please sign in again.",
    );
  }
}
