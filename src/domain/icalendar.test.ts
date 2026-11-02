import { describe, expect, it } from "vitest";
import {
  alarmesDoPrazo,
  type ConcursoCalendario,
  deslocamentoAlarme,
  dobrarLinha,
  type EventoCalendario,
  escaparTexto,
  eventosDoCalendario,
  formatarDuracao,
  formatarUtc,
  gerarIcs,
  type OpcoesCalendario,
} from "./icalendar";
import { mesclarRegras } from "./notificacoes";

const AGORA = new Date("2026-11-10T15:04:05.678Z");
const bytes = (s: string) => new TextEncoder().encode(s).length;

/** Desfaz a dobra (RFC 5545 §3.1) e separa as linhas. */
const desdobrar = (ics: string) => ics.replace(/\r\n /g, "").split("\r\n");

describe("escaparTexto", () => {
  it("escapa barra invertida, ponto e vírgula, vírgula e quebras de linha", () => {
    expect(escaparTexto("a\\b;c,d\ne\r\nf")).toBe("a\\\\b\\;c\\,d\\ne\\nf");
  });
});

describe("dobrarLinha", () => {
  it("não mexe em linhas de até 75 octetos", () => {
    const linha = "x".repeat(75);
    expect(dobrarLinha(linha)).toBe(linha);
  });

  it("dobra em 75 octetos, com continuação iniciada por espaço", () => {
    const linha = `SUMMARY:${"a".repeat(200)}`;
    const partes = dobrarLinha(linha).split("\r\n");
    expect(partes.length).toBeGreaterThan(2);
    for (const p of partes) expect(bytes(p)).toBeLessThanOrEqual(75);
    for (const p of partes.slice(1)) expect(p.startsWith(" ")).toBe(true);
    expect(partes.map((p, i) => (i === 0 ? p : p.slice(1))).join("")).toBe(linha);
  });

  it("conta octetos UTF-8 e nunca corta um caractere ao meio", () => {
    const linha = `SUMMARY:${"ção📘".repeat(30)}`;
    const partes = dobrarLinha(linha).split("\r\n");
    for (const p of partes) expect(bytes(p)).toBeLessThanOrEqual(75);
    expect(partes.map((p, i) => (i === 0 ? p : p.slice(1))).join("")).toBe(linha);
    expect(partes.join("")).not.toContain("�");
  });
});

describe("formatos", () => {
  it("UTC sem milissegundos", () => {
    expect(formatarUtc(AGORA)).toBe("20261110T150405Z");
  });

  it("durações do TRIGGER", () => {
    expect(formatarDuracao(0)).toBe("PT0S");
    expect(formatarDuracao(-7 * 1440)).toBe("-P7D");
    expect(formatarDuracao(-120)).toBe("-PT2H");
    expect(formatarDuracao(9 * 60)).toBe("PT9H");
    expect(formatarDuracao(-(6 * 1440 + 15 * 60 + 30))).toBe("-P6DT15H30M");
  });

  it("alarmes: dia inteiro às 9h do dia do aviso; com hora, mesmo horário ou 2 h antes", () => {
    expect(deslocamentoAlarme(0, false)).toBe(9 * 60);
    expect(deslocamentoAlarme(1, false)).toBe(-15 * 60);
    expect(deslocamentoAlarme(7, false)).toBe(-7 * 1440 + 9 * 60);
    expect(deslocamentoAlarme(0, true)).toBe(-120);
    expect(deslocamentoAlarme(3, true)).toBe(-3 * 1440);
  });
});

describe("gerarIcs", () => {
  const ics = gerarIcs(
    {
      nome: "Concursos",
      eventos: [
        { uid: "evento-1@app", data: "2026-11-20", hora: null, resumo: "Fim, das; inscrições" },
        {
          uid: "evento-2@app",
          data: "2026-12-06",
          hora: "13:30",
          resumo: "Prova objetiva",
          local: "Escola X",
          descricao: "Levar documento\ncom foto",
          url: "https://app.exemplo.com/concursos/1",
          ultimaAlteracao: new Date("2026-11-01T10:00:00Z"),
          alarmes: [1, 7, 1],
        },
      ],
    },
    AGORA,
  );
  const linhas = desdobrar(ics);

  it("usa CRLF, abre e fecha o calendário e tem os campos obrigatórios", () => {
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
    expect(linhas[0]).toBe("BEGIN:VCALENDAR");
    expect(linhas).toContain("VERSION:2.0");
    expect(linhas.filter((l) => l.startsWith("PRODID:"))).toHaveLength(1);
    expect(linhas.filter((l) => l === "BEGIN:VEVENT")).toHaveLength(2);
    expect(linhas.filter((l) => l === "DTSTAMP:20261110T150405Z")).toHaveLength(2);
  });

  it("evento sem hora é de dia inteiro (DTEND exclusivo)", () => {
    expect(linhas).toContain("DTSTART;VALUE=DATE:20261120");
    expect(linhas).toContain("DTEND;VALUE=DATE:20261121");
    expect(linhas).toContain("SUMMARY:Fim\\, das\\; inscrições");
  });

  it("evento com hora vai em UTC (Brasília = UTC−3), com 1 h de duração", () => {
    expect(linhas).toContain("DTSTART:20261206T163000Z");
    expect(linhas).toContain("DTEND:20261206T173000Z");
    expect(linhas).toContain("LOCATION:Escola X");
    expect(linhas).toContain("DESCRIPTION:Levar documento\\ncom foto");
    expect(linhas).toContain("URL:https://app.exemplo.com/concursos/1");
    expect(linhas).toContain("LAST-MODIFIED:20261101T100000Z");
  });

  it("um VALARM por antecedência, sem repetir", () => {
    expect(linhas.filter((l) => l === "BEGIN:VALARM")).toHaveLength(2);
    expect(linhas).toContain("TRIGGER:-P7D");
    expect(linhas).toContain("TRIGGER:-P1D");
  });

  it("respeita o fuso histórico (horário de verão de 2018)", () => {
    const verao = desdobrar(
      gerarIcs(
        { nome: "x", eventos: [{ uid: "u", data: "2018-12-01", hora: "10:00", resumo: "x" }] },
        AGORA,
      ),
    );
    expect(verao).toContain("DTSTART:20181201T120000Z");
  });
});

describe("eventosDoCalendario", () => {
  const concursos: ConcursoCalendario[] = [
    {
      id: 1,
      status: "INSCRITO",
      orgao: "TRF 3ª Região",
      cargo: "Analista",
      icone: "⚖️",
      validadeFim: null,
    },
    { id: 2, status: "EMPOSSADO", orgao: "Prefeitura", cargo: "Técnico", validadeFim: null },
    {
      id: 3,
      status: "APROVADO",
      orgao: "INSS",
      cargo: "Técnico",
      validadeFim: "2027-05-10",
      updatedAt: new Date("2026-10-01T00:00:00Z"),
    },
    {
      id: 4,
      status: "INSCRITO",
      orgao: "Silenciado",
      cargo: "X",
      validadeFim: null,
      notificacoesSilenciadas: true,
    },
  ];
  const eventos: EventoCalendario[] = [
    {
      id: 10,
      concursoId: 1,
      tipo: "FIM_INSCRICOES",
      titulo: null,
      data: "2026-11-20",
      hora: null,
      concluido: false,
      observacao: "Pagar até 18h",
    },
    {
      id: 11,
      concursoId: 1,
      tipo: "PUBLICACAO_EDITAL",
      titulo: "Edital nº 1",
      data: "2026-10-01",
      hora: null,
      concluido: true,
    },
    {
      id: 12,
      concursoId: 2,
      tipo: "POSSE",
      titulo: null,
      data: "2026-12-01",
      hora: null,
      concluido: false,
    },
    {
      id: 13,
      concursoId: 4,
      tipo: "PROVA_OBJETIVA",
      titulo: null,
      data: "2026-12-06",
      hora: "13:00",
      concluido: false,
    },
    {
      id: 14,
      concursoId: 99,
      tipo: "OUTRO",
      titulo: null,
      data: "2026-12-06",
      hora: null,
      concluido: false,
    },
  ];
  const opcoes = (parcial: Partial<OpcoesCalendario> = {}): OpcoesCalendario => ({
    regras: mesclarRegras(),
    incluirConcluidos: false,
    incluirEncerrados: false,
    urlBase: "https://app.exemplo.com/",
    ...parcial,
  });

  it("UID estável por prazo, com o host do app", () => {
    const uids = eventosDoCalendario(eventos, concursos, opcoes()).map((e) => e.uid);
    expect(uids).toEqual([
      "evento-10@app.exemplo.com",
      "evento-13@app.exemplo.com",
      "validade-3@app.exemplo.com",
    ]);
    // Mesmos dados, mesmos UIDs (o calendário atualiza em vez de duplicar).
    expect(eventosDoCalendario(eventos, concursos, opcoes()).map((e) => e.uid)).toEqual(uids);
  });

  it("resumo com ícone, tipo e órgão; descrição com concurso, observação e link", () => {
    const [fim] = eventosDoCalendario(eventos, concursos, opcoes());
    expect(fim).toMatchObject({
      resumo: "⚖️ Fim das inscrições — TRF 3ª Região",
      url: "https://app.exemplo.com/concursos/1",
    });
    expect(fim?.descricao).toContain("Concurso: TRF 3ª Região — Analista");
    expect(fim?.descricao).toContain("Pagar até 18h");
    expect(fim?.descricao).toContain("Abrir no app: https://app.exemplo.com/concursos/1");
  });

  it("opções: concluídos e concursos encerrados", () => {
    const todos = eventosDoCalendario(
      eventos,
      concursos,
      opcoes({ incluirConcluidos: true, incluirEncerrados: true }),
    );
    expect(todos.map((e) => e.uid.split("@")[0])).toEqual([
      "evento-11",
      "evento-10",
      "evento-12",
      "evento-13",
      "validade-3",
    ]);
    const concluido = todos.find((e) => e.uid.startsWith("evento-11"));
    expect(concluido?.resumo).toBe("✓ ⚖️ Edital nº 1 — TRF 3ª Região");
    expect(concluido?.descricao).toContain("Tipo: Publicação do edital");
    expect(concluido?.alarmes).toEqual([]);
  });

  it("alarmes só em prazos críticos pendentes de concursos ativos e não silenciados", () => {
    const todos = eventosDoCalendario(eventos, concursos, opcoes({ incluirEncerrados: true }));
    const alarmes = Object.fromEntries(todos.map((e) => [e.uid.split("@")[0], e.alarmes]));
    expect(alarmes["evento-10"]).toEqual([7, 1, 0]);
    expect(alarmes["evento-12"]).toEqual([]); // concurso encerrado
    expect(alarmes["evento-13"]).toEqual([]); // silenciado
    expect(alarmes["validade-3"]).toEqual([]); // validade não é prazo crítico
  });

  it("alarmes seguem as regras do usuário", () => {
    const regras = mesclarRegras([{ tipo: "FIM_INSCRICOES", ativo: true, antecedencias: [3] }]);
    expect(
      alarmesDoPrazo("FIM_INSCRICOES", false, concursos[0] as ConcursoCalendario, regras),
    ).toEqual([3]);
    const desligado = mesclarRegras([{ tipo: "FIM_INSCRICOES", ativo: false, antecedencias: [3] }]);
    expect(
      alarmesDoPrazo("FIM_INSCRICOES", false, concursos[0] as ConcursoCalendario, desligado),
    ).toEqual([]);
  });

  it("fim da validade derivado, suprimido por evento VALIDADE explícito", () => {
    const [validade] = eventosDoCalendario([], [concursos[2] as ConcursoCalendario], opcoes());
    expect(validade).toMatchObject({
      uid: "validade-3@app.exemplo.com",
      data: "2027-05-10",
      hora: null,
      resumo: "Fim da validade do concurso — INSS",
    });
    const explicito: EventoCalendario = {
      id: 20,
      concursoId: 3,
      tipo: "VALIDADE",
      titulo: null,
      data: "2027-06-01",
      hora: null,
      concluido: false,
    };
    expect(
      eventosDoCalendario([explicito], [concursos[2] as ConcursoCalendario], opcoes()).map(
        (e) => e.uid,
      ),
    ).toEqual(["evento-20@app.exemplo.com"]);
  });
});
