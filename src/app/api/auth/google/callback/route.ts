/** `GET /api/auth/google/callback` (#49): retorno do Google (ver `server/auth/login-google.ts`). */
import type { NextRequest } from "next/server";
import { concluirLoginGoogle } from "@/server/auth/login-google";

export function GET(request: NextRequest) {
  return concluirLoginGoogle(request);
}
