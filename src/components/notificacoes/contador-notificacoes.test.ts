import { describe, expect, it } from "vitest";
import { rotuloNotificacoes, textoContadorNotificacoes } from "./contador-notificacoes";

describe("textoContadorNotificacoes", () => {
  it("mostra o número até 99 e 99+ acima disso", () => {
    expect(textoContadorNotificacoes(1)).toBe("1");
    expect(textoContadorNotificacoes(99)).toBe("99");
    expect(textoContadorNotificacoes(100)).toBe("99+");
  });
});

describe("rotuloNotificacoes", () => {
  it("inclui o número real, com singular e plural", () => {
    expect(rotuloNotificacoes(0)).toBe("Notificações (nenhuma não lida)");
    expect(rotuloNotificacoes(1)).toBe("Notificações (1 não lida)");
    expect(rotuloNotificacoes(3)).toBe("Notificações (3 não lidas)");
    // O selo mostra "99+", mas o nome acessível diz o total.
    expect(rotuloNotificacoes(150)).toBe("Notificações (150 não lidas)");
  });

  it("começa pelo rótulo visível (o nome acessível contém o texto da tela)", () => {
    expect(rotuloNotificacoes(5).startsWith("Notificações")).toBe(true);
  });
});
