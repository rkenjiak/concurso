/** `GET /api/auth/google` (#49): inicia o login com Google (ver `server/auth/login-google.ts`). */
import type { NextRequest } from "next/server";
import { iniciarLoginGoogle } from "@/server/auth/login-google";

export function GET(request: NextRequest) {
  return iniciarLoginGoogle(request);
}
