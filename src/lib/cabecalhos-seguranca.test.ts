import { describe, expect, it } from "vitest";
import { cabecalhosSeguranca, valorCsp } from "./cabecalhos-seguranca";

const cabecalho = (dev: boolean, nome: string) =>
  cabecalhosSeguranca(dev).find((c) => c.key === nome)?.value;

describe("cabeçalhos de segurança (#95)", () => {
  it("define CSP, anti-clickjacking, nosniff, Referrer-Policy e Permissions-Policy", () => {
    expect(cabecalhosSeguranca(false).map((c) => c.key)).toEqual([
      "Content-Security-Policy",
      "X-Frame-Options",
      "X-Content-Type-Options",
      "Referrer-Policy",
      "Permissions-Policy",
      "Cross-Origin-Opener-Policy",
    ]);
    expect(cabecalho(false, "X-Frame-Options")).toBe("DENY");
    expect(cabecalho(false, "X-Content-Type-Options")).toBe("nosniff");
    expect(cabecalho(false, "Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(cabecalho(false, "Permissions-Policy")).toContain("camera=(), microphone=()");
    expect(cabecalho(false, "Permissions-Policy")).toContain("geolocation=()");
  });

  it("a CSP bloqueia embutir o app, plugins e destinos externos de formulários", () => {
    const csp = valorCsp(false);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("img-src 'self' data: blob: https://*.googleusercontent.com");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("'unsafe-eval' e WebSocket do HMR só em desenvolvimento", () => {
    expect(valorCsp(false)).not.toContain("'unsafe-eval'");
    expect(valorCsp(true)).toMatch(/script-src [^;]*'unsafe-eval'/);
    expect(valorCsp(false)).toContain("connect-src 'self';");
    expect(valorCsp(true)).toContain("connect-src 'self' ws: wss:;");
  });
});
