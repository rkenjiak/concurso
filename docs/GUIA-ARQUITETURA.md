# Guia visual da arquitetura

> Um passeio didático pelo app **concurso**: como as peças se encaixam e por quê.
> Para a especificação completa (campos, enums, roadmap), veja [`ARQUITETURA.md`](./ARQUITETURA.md);
> para o "o quê", veja [`REQUISITOS.md`](./REQUISITOS.md).
>
> Os diagramas usam [Mermaid](https://mermaid.js.org) e aparecem renderizados no GitHub e no VS Code
> (com a extensão *Markdown Preview Mermaid Support*).

---

## Sumário

1. [A ideia em uma frase](#1-a-ideia-em-uma-frase)
2. [O mapa geral](#2-o-mapa-geral)
3. [As camadas, de fora para dentro](#3-as-camadas-de-fora-para-dentro)
4. [A regra de dependência](#4-a-regra-de-dependência)
5. [Como uma página é lida](#5-como-uma-página-é-lida)
6. [Como uma alteração é gravada](#6-como-uma-alteração-é-gravada)
7. [O coração do domínio: status, prazos e lembretes](#7-o-coração-do-domínio-status-prazos-e-lembretes)
8. [O modelo de dados](#8-o-modelo-de-dados)
9. [Autenticação e multiusuário: quem passa pela porta](#9-autenticação-e-multiusuário-quem-passa-pela-porta)
10. [Servidor MCP: uma LLM como segunda "interface"](#10-servidor-mcp-uma-llm-como-segunda-interface)
11. [Inicialização do servidor](#11-inicialização-do-servidor)
12. [Onde o app roda](#12-onde-o-app-roda)
13. [Testes e entrega](#13-testes-e-entrega)
14. [Mapa de pastas e "onde mexo para…"](#14-mapa-de-pastas-e-onde-mexo-para)
15. [Glossário](#15-glossário)

---

## 1. A ideia em uma frase

> **Um único projeto Next.js** em que o servidor lê e grava num **SQLite**, as **regras de negócio
> ficam em TypeScript puro** e tudo o mais (páginas, formulários, MCP, export) é só uma "casca" fina
> em volta dessas regras.

Três princípios explicam quase todas as decisões:

| Princípio | Consequência prática |
|---|---|
| **Poucos usuários, centenas de registros** | SQLite em arquivo; sem filas, cache distribuído ou microsserviços. Cada usuário só vê os próprios concursos. |
| **Roda com um comando** | `pnpm dev` aplica migrações e cria o banco sozinho. |
| **O framework muda rápido; as regras não** | Regras em `src/domain/` (sem Next, sem banco), testadas isoladamente. |

---

## 2. O mapa geral

Quem conversa com quem, do navegador (ou da LLM) até o banco:

```mermaid
flowchart LR
  subgraph Clientes
    NAV["🖥️ Navegador<br/>desktop / celular / PWA"]
    CAL["📅 App de calendário<br/>(feed .ics)"]
    LLM["🤖 Cliente MCP<br/>(LLM lendo o edital)"]
  end

  subgraph Next["Next.js — um único processo Node"]
    PX["proxy.ts<br/>porteiro de autenticação"]
    RSC["Páginas<br/>(Server Components)"]
    SA["Server Actions<br/>(mutações)"]
    RH["Route Handlers<br/>/api/export · import · health<br/>auth/google · calendario.ics"]
    MCPR["/api/mcp<br/>(Route Handler)"]
    subgraph Server["src/server"]
      Q["queries/<br/>leituras"]
      R["repositories/<br/>escritas em transação"]
      M["mcp/<br/>ferramentas"]
    end
    D["domain/<br/>regras puras"]
  end

  DB[("SQLite / libSQL<br/>arquivo local ou Turso")]
  STDIO["scripts/mcp.ts<br/>(stdio)"]

  NAV -->|HTTP| PX
  PX --> RSC & SA & RH
  CAL -->|"HTTP + token do feed"| RH
  LLM -->|"HTTP + Bearer"| MCPR
  LLM -.->|stdio, local| STDIO
  MCPR --> M
  STDIO --> M
  RSC --> Q
  RH --> Q & R
  SA --> R
  M --> Q & R
  Q --> D
  R --> D
  Q --> DB
  R --> DB

  classDef dom fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
  classDef db fill:#e3f2fd,stroke:#1565c0,color:#0d47a1
  class D dom
  class DB db
```

**Leitura do diagrama:**

- Há **três portas de entrada**: o navegador (pelas páginas), uma LLM (pelo protocolo MCP) e o
  app de calendário que assina o feed `.ics`. Todas chegam nos **mesmos** `queries/` e
  `repositories/` — não existe "lógica duplicada para a IA".
- Toda leitura e escrita recebe o `usuarioId` de quem pediu (sessão, token do MCP ou token do
  feed) e filtra por ele: um usuário nunca enxerga os concursos de outro.
- **Ler** e **escrever** são caminhos separados: `queries/` só lê; `repositories/` só escreve
  (sempre em transação).
- O bloco verde (`domain/`) não conhece Next.js nem banco. É chamado por quem precisa de uma regra.

---

## 3. As camadas, de fora para dentro

Pense no app como uma cebola. Cada camada só conhece as que estão **dentro** dela.

```mermaid
flowchart TB
  subgraph L1["① Apresentação — src/app, src/components"]
    direction LR
    A1["Páginas (RSC)"] --- A2["Componentes cliente<br/>formulários, diálogos"] --- A3["shadcn/ui + Tailwind"]
  end
  subgraph L2["② Entrada do servidor — src/server/actions, src/app/api, src/server/mcp"]
    direction LR
    B1["Server Actions"] --- B2["Route Handlers"] --- B3["Servidor MCP"]
  end
  subgraph L3["③ Acesso a dados — src/server/queries, src/server/repositories"]
    direction LR
    C1["queries (leitura)"] --- C2["repositories (escrita)"]
  end
  subgraph L4["④ Domínio — src/domain  +  utilitários puros — src/lib"]
    direction LR
    D1["status · prazos · validade<br/>notificações · icalendar · sugestão<br/>cores · duplicados · quadro · calendário"] --- D2["schemas Zod · tz · format<br/>normalize · csv · tema · pwa"]
  end
  subgraph L5["⑤ Persistência — src/server/db"]
    direction LR
    E1["schema.ts (Drizzle)"] --- E2["client.ts (libSQL)"] --- E3["drizzle/*.sql (migrações)"]
  end

  L1 --> L2 --> L3 --> L4
  L3 --> L5

  style L4 fill:#e8f5e9,stroke:#2e7d32
  style L5 fill:#e3f2fd,stroke:#1565c0
```

| Camada | Pergunta que responde | Exemplo real |
|---|---|---|
| ① Apresentação | *Como isso aparece na tela?* | `components/concurso/alterar-status.tsx` |
| ② Entrada | *Quem pediu? Os dados vieram certos? Pode?* | `server/actions/status.ts` |
| ③ Dados | *Como leio/gravo isso no banco?* | `server/repositories/status.ts` |
| ④ Domínio | *Isso é permitido pelas regras do negócio?* | `domain/status.ts` → `exigirTransicao()` |
| ⑤ Persistência | *Como é a tabela?* | `server/db/schema.ts` |

---

## 4. A regra de dependência

A seta sempre aponta **para dentro**. Nada no domínio importa de fora.

```mermaid
flowchart LR
  UI["app/ · components/"] --> ACT["server/actions · app/api · server/mcp"]
  ACT --> DATA["server/queries · server/repositories"]
  DATA --> DOM["domain/"]
  ACT --> LIB["lib/ (schemas Zod, tz, format)"]
  UI --> LIB
  DOM --> LIB
  DATA --> DB["server/db"]

  DOM -. "❌ nunca importa" .-> NEXT["next/*"]
  DOM -. "❌ nunca importa" .-> DB

  style DOM fill:#e8f5e9,stroke:#2e7d32
  style NEXT fill:#ffebee,stroke:#c62828
```

**Por que isso importa?**

- `domain/` é testado com Vitest em milissegundos, sem subir servidor nem banco.
- Se uma API do Next mudar (como `middleware.ts` → `proxy.ts` no Next 16), as regras não mudam.
- O `hoje` é sempre **parâmetro** das funções do domínio (nunca `new Date()` solto). Assim os testes
  são determinísticos e o fuso de Brasília é tratado num lugar só (`lib/tz.ts`).

---

## 5. Como uma página é lida

Exemplo: abrir o **Dashboard** (`/`). Tudo acontece no servidor; o navegador recebe HTML pronto.

```mermaid
sequenceDiagram
  autonumber
  actor U as Usuário
  participant P as proxy.ts
  participant Pg as app/(app)/page.tsx<br/>(Server Component)
  participant Q as queries/dashboard.ts
  participant D as domain/prazos.ts
  participant DB as SQLite

  U->>P: GET /
  P->>P: auth ligada? cookie de sessão válido?
  P->>Pg: segue
  Pg->>Pg: usuario = exigirUsuarioPagina()<br/>hoje = hojeSP()  (America/Sao_Paulo)
  Pg->>Q: obterDashboard(db, usuario.id, hoje)
  Q->>DB: SELECT eventos + concursos ativos do usuário
  DB-->>Q: linhas
  Q->>D: proximosPrazos(eventos, concursos, hoje, 30)
  D-->>Q: grupos: vencidos · hoje · próximos
  Q-->>Pg: dados prontos
  Pg-->>U: HTML renderizado
```

Pontos-chave:

- **Não há API REST para a tela.** O componente de página é `async` e chama a query diretamente.
- A query busca o mínimo no SQL e delega a **regra** (o que é vencido, o que é crítico) ao domínio.
- Em paralelo, a página pede o contador do sino (`queries/notificacoes.ts`) e as sugestões de
  status (`queries/sugestoes.ts`) — ambos calculados na hora, sem cron (§7.4).
- Componentes interativos (`"use client"`) são só as "ilhas" que precisam de estado: formulários,
  diálogos, seletor de tema, quadro arrastável.

---

## 6. Como uma alteração é gravada

Exemplo: mudar o status de um concurso para **Inscrito**. Este é o padrão de **todas** as mutações.

```mermaid
sequenceDiagram
  autonumber
  actor U as Usuário
  participant C as alterar-status.tsx<br/>("use client")
  participant A as actions/status.ts<br/>("use server")
  participant Au as auth/acesso.ts
  participant Z as lib/schemas (Zod)
  participant R as repositories/status.ts
  participant D as domain/status.ts
  participant DB as SQLite

  U->>C: escolhe "Inscrito" e confirma
  C->>A: alterarStatus(id, { para, observacao })
  A->>Au: exigirUsuarioAcao()
  Au-->>A: usuário (ou "Sessão expirada")
  A->>Z: safeParse(entrada)
  Z-->>A: dados tipados (ou erros por campo)
  A->>R: alterarStatus(db, usuarioId, id, para, obs)
  rect rgb(232, 245, 233)
    note over R,DB: uma única transação
    R->>DB: concurso do usuário? status atual + histórico
    R->>D: exigirTransicao(de, para, contexto)
    D-->>R: ok — ou lança ErroDominio
    R->>DB: INSERT status_historico
    R->>DB: UPDATE concurso.status
  end
  A->>A: revalidatePath("/", "/concursos", "/concursos/id")
  A-->>C: { ok: true, data } ou { ok: false, erros }
  C->>C: router.refresh() ou mostra erros
```

A "receita" de uma Server Action, em 5 passos:

```mermaid
flowchart LR
  S1["1. exigirUsuarioAcao()<br/>sessão → usuarioId"] --> S2["2. Zod<br/>validar entrada"] --> S3["3. repository<br/>transação + domínio"] --> S4["4. revalidatePath<br/>atualiza telas"] --> S5["5. ResultadoAcao<br/>{ ok, data | erros }"]
```

E os erros viram mensagens amigáveis num lugar só (`actions/resultado.ts → executar()`):

```mermaid
flowchart TD
  E{"Algo deu errado?"} -->|"Zod falhou"| F1["erros por campo<br/>{ cargo: ['Obrigatório'] }"]
  E -->|"ErroDominio"| F2["mensagem da regra<br/>'Não é possível mudar de X para Y'"]
  E -->|"exceção inesperada"| F3["console.error no servidor<br/>+ mensagem genérica ao usuário"]
  E -->|não| OK["{ ok: true, data }"]
```

> 💡 O **mesmo schema Zod** valida o formulário no navegador (react-hook-form) e de novo no servidor.
> E o MCP também reaproveita esses schemas — uma regra de validação, três usos.

---

## 7. O coração do domínio: status, prazos e lembretes

### 7.1 A máquina de estados do status

Cada concurso percorre uma trilha. `domain/status.ts` decide quais saltos são válidos; a UI só
oferece as opções permitidas e o repositório confere de novo.

```mermaid
stateDiagram-v2
  direction LR
  [*] --> PREVISTO

  state "Trilha principal (pode pular etapas para frente)" as trilha {
    PREVISTO --> EDITAL_PUBLICADO
    EDITAL_PUBLICADO --> INSCRITO
    INSCRITO --> PROVA_AGENDADA
    PROVA_AGENDADA --> PROVA_REALIZADA
    PROVA_REALIZADA --> AGUARDANDO_RESULTADO
  }

  PREVISTO --> NAO_INSCRITO
  EDITAL_PUBLICADO --> NAO_INSCRITO

  PROVA_REALIZADA --> Resultado
  AGUARDANDO_RESULTADO --> Resultado

  state "Resultado (revisáveis entre si)" as Resultado {
    APROVADO --> CLASSIFICADO
    CLASSIFICADO --> APROVADO
    APROVADO --> REPROVADO
    REPROVADO --> APROVADO
  }

  Resultado --> NOMEADO : aprovado / classificado
  NOMEADO --> EMPOSSADO
  EMPOSSADO --> [*]
  NAO_INSCRITO --> [*]
```

Regras que não cabem bem no desenho:

| Regra | Detalhe |
|---|---|
| **Desistir** | De `INSCRITO` em diante, e de `APROVADO`/`CLASSIFICADO`/`NOMEADO` → `DESISTIU`. |
| **Suspender / cancelar** | Qualquer status não terminal → `SUSPENSO` ou `CANCELADO`. |
| **Retomar** | `SUSPENSO` só volta para o status de **antes** da suspensão (lido do histórico). |
| **Terminais** | `EMPOSSADO`, `DESISTIU`, `NAO_INSCRITO`, `CANCELADO` e `REPROVADO` (salvo revisão). |
| **Desfazer** | Sempre dá para desfazer a **última** mudança (corrige clique errado sem abrir brecha). |

### 7.2 De eventos a "próximos prazos"

```mermaid
flowchart LR
  EV["Eventos do banco<br/>(não concluídos)"] --> F1{"Concurso<br/>ativo?"}
  VAL["Validade calculada<br/>domain/validade.ts"] -->|"pseudo-evento<br/>se não houver VALIDADE"| F1
  F1 -->|sim| CL["Classifica pela data<br/>vs. hoje (Brasília)"]
  F1 -->|não| X["descarta"]
  CL --> G1["🔴 Vencidos<br/>(só tipos críticos)"]
  CL --> G2["🟠 Hoje"]
  CL --> G3["🟢 Próximos 30 dias"]
  G1 & G2 & G3 --> ORD["Ordena: data → hora → criticidade<br/>marca ≤3 dias alta, ≤7 média"]
  ORD --> OC{"oculto no<br/>dashboard?"}
  OC -->|"não, ou ?ocultos=1"| TELA["Dashboard"]
  OC -->|sim| CNT["contador 'N ocultos'"]
```

### 7.3 Validade do concurso

```mermaid
flowchart TD
  A{"validade_fim_manual<br/>preenchida?"} -->|sim| R1["usa a data manual"]
  A -->|não| B{"homologação +<br/>validade_meses?"}
  B -->|não| R2["indefinida"]
  B -->|sim| C["fim = homologação + meses"]
  C --> P{"prorrogada?"}
  P -->|sim| R3["fim + meses<br/>(CF art. 37, III)"]
  P -->|não| R4["fim"]
```

### 7.4 Lembretes: notificações, calendário e sugestão de status

Os lembretes (#65) **não usam cron nem e-mail**: tudo é calculado na hora, a partir dos eventos
pendentes, das regras do usuário e de "hoje".

```mermaid
flowchart LR
  EV["Eventos pendentes<br/>+ pseudo-evento de validade"] --> N["domain/notificacoes.ts<br/>regras por tipo × antecedências"]
  RG["regra_notificacao<br/>(só o que difere do padrão)"] --> N
  N --> SINO["🔔 Sino + /notificacoes<br/>lida/dispensada em notificacao_estado"]
  EV --> ICS["domain/icalendar.ts<br/>RFC 5545 + VALARM"]
  RG --> ICS
  ICS --> FEED["/api/calendario.ics?token=…<br/>Google / Apple / Outlook"]
  EV --> SUG["domain/sugestao-status.ts"]
  SUG --> AP["'Aplicar' no detalhe e no dashboard<br/>→ alterarStatus validado"]
```

| Peça | Regra principal |
|---|---|
| **Notificação** | Identidade = (prazo, antecedência), sem a data: retificar a data não duplica o aviso. Por prazo, só vale a antecedência vigente (quem abre o app na véspera vê só "amanhã"). |
| **Silenciar** | Por concurso: cala avisos e alarmes daquele concurso. Eventos concluídos e concursos encerrados não notificam. |
| **Feed .ics** | Token pessoal (`cics_…`, só o SHA-256 no banco), `UID` estável por evento, alarmes só nos prazos críticos pendentes. |
| **Sugestão de status** | Só sugere (prova passada → "Prova realizada", etc.); "Aplicar" recalcula no servidor e grava o motivo no histórico. |

---

## 8. O modelo de dados

O **usuário** é dono dos concursos, e o **concurso** é o centro: tudo mais pendura nele (e é
apagado junto, via `ON DELETE CASCADE`).

```mermaid
erDiagram
  USUARIO ||--o{ CONCURSO : "é dono"
  USUARIO ||--o{ REGRA_NOTIFICACAO : "personaliza"
  USUARIO ||--o{ AUDITORIA_ADMIN : "executou"
  USUARIO ||--o{ EMAIL_PERMITIDO : "liberou"
  CONCURSO ||--o{ EVENTO : "tem datas"
  CONCURSO ||--o{ LINK : "tem links"
  CONCURSO ||--o{ STATUS_HISTORICO : "registra"
  CONCURSO ||--o{ RESULTADO_FASE : "tem notas"
  CONCURSO ||--o{ CONCURSO_TAG : ""
  TAG ||--o{ CONCURSO_TAG : ""
  EVENTO ||--o{ NOTIFICACAO_ESTADO : "lida/dispensada"

  USUARIO {
    int id PK
    text email UK "nulo só no usuário inicial"
    text google_sub UK
    text papel "USUARIO | ADMIN"
    text mcp_token_hash "SHA-256"
    text ics_token_hash "SHA-256"
    int bloqueado_em "nulo = ativo"
  }
  CONCURSO {
    int id PK
    int usuario_id FK
    text orgao
    text cargo
    text banca
    text status "atual (cópia do último histórico)"
    int remuneracao_centavos "dinheiro em centavos"
    text homologacao_data "YYYY-MM-DD"
    int validade_meses
    text cor "null = automática"
    text icone "um emoji"
    bool notificacoes_silenciadas
    text busca_normalizada "sem acento, p/ busca"
  }
  EVENTO {
    int id PK
    int concurso_id FK
    text tipo "FIM_INSCRICOES, PROVA_OBJETIVA..."
    text data "YYYY-MM-DD (Brasília)"
    text hora "HH:mm opcional"
    bool concluido
    bool oculto_dashboard
  }
  STATUS_HISTORICO {
    int id PK
    int concurso_id FK
    text de "null na criação"
    text para
    int alterado_em "epoch ms UTC"
  }
  RESULTADO_FASE {
    int id PK
    int concurso_id FK
    text fase
    real nota
    real nota_corte
    int classificacao_geral
    text situacao
  }
  LINK {
    int id PK
    int concurso_id FK
    text tipo
    text url
    int ordem
  }
  TAG {
    int id PK
    text nome UK
  }
  CONCURSO_TAG {
    int concurso_id FK
    int tag_id FK
  }
```

Tabelas de apoio (fora do diagrama para não poluir): `regra_notificacao` e `notificacao_estado`
(lembretes, #65), `email_permitido` e `auditoria_admin` (painel admin, #50). A `tag` é um vocabulário
compartilhado só de nomes; cada usuário vê apenas as tags dos próprios concursos. Detalhes campo a
campo em [`ARQUITETURA.md` §3](./ARQUITETURA.md#3-modelo-de-dados).

Convenções que evitam bugs clássicos:

| Tipo de dado | Como é guardado | Por quê |
|---|---|---|
| Data de calendário (prova, inscrição) | `text` `YYYY-MM-DD`, horário de Brasília | Uma prova "dia 10" nunca vira "dia 9" por causa de fuso. |
| Instante técnico (`created_at`, `alterado_em`) | `integer` epoch ms, UTC | Ordenação e comparação simples. |
| Dinheiro | `integer` em **centavos** | Sem erro de ponto flutuante (`0,1 + 0,2`). |
| Enums | `text` em `SNAKE_CASE` | Legível no banco; rótulos pt-BR em `domain/labels.ts`. |
| Status atual | Coluna em `concurso` **e** histórico | Lista rápida sem `JOIN`; histórico para timeline e "desfazer". |

As migrações vivem em `drizzle/*.sql`, geradas a partir de `src/server/db/schema.ts`:

```mermaid
flowchart LR
  S["schema.ts<br/>(edito aqui)"] -->|pnpm db:generate| M["drizzle/000N_*.sql<br/>(versionado no Git)"]
  M -->|"pnpm db:migrate<br/>(automático no dev/build)"| DB[("banco")]
```

---

## 9. Autenticação e multiusuário: quem passa pela porta

A autenticação é **opcional** e ligada por variável de ambiente. Há três modos:

| Modo | Variáveis | Quem entra |
|---|---|---|
| **Sem login** (uso local) | nenhuma | todos os dados são do **usuário inicial** (ID 1) |
| **Senha única** (uso local) | `APP_PASSWORD` + `AUTH_SECRET` | sempre o usuário inicial |
| **Google** (multiusuário) | `GOOGLE_CLIENT_ID/SECRET` + `ADMIN_EMAILS` + `AUTH_SECRET` | e-mails da allowlist; o primeiro admin a entrar assume o usuário inicial |

Há duas checagens (defesa em profundidade): o `proxy.ts` na entrada, que só confere a assinatura do
cookie (sem banco), e `auth/acesso.ts` em cada página, action e handler, que relê o usuário no banco
(bloqueado? ainda na allowlist?).

```mermaid
flowchart TD
  REQ["Requisição"] --> H{"algum login<br/>configurado?"}
  H -->|não| LIVRE["✅ passa<br/>(uso local, usuário inicial)"]
  H -->|sim| PUB{"rota pública?<br/>/login · /api/health · /api/auth/google…<br/>/api/mcp · /api/calendario.ics<br/>manifest e ícones do PWA"}
  PUB -->|sim| LIVRE2["✅ passa<br/>(MCP e feed se autenticam por token)"]
  PUB -->|não| COOK{"cookie JWT<br/>com assinatura válida?"}
  COOK -->|sim| OK["✅ passa"]
  COOK -->|não| API{"/api/* ?"}
  API -->|sim| E401["401 JSON"]
  API -->|não| RED["↪ /login?para=rota-original"]

  OK --> SA["Página / Server Action / Route Handler"]
  SA --> VA{"exigirUsuario…()<br/>relê o usuário no banco"}
  VA -->|ativo e autorizado| GO["executa com usuarioId"]
  VA -->|não| ERR["'Sessão expirada' / login"]
```

**Painel admin (#50).** Usuários com papel `ADMIN` alternam entre "Visão admin" e "Visão usuário"
no menu da conta (cookie `concurso_visao`). A visão **nunca** concede acesso: `/admin` chama
`exigirAdminPagina()` e as ações, `exigirAdminAcao()`, que conferem o papel no banco. Toda ação do
painel grava em `auditoria_admin`, e sempre resta ao menos um admin ativo.

Proteções extras, de relance:

```mermaid
mindmap
  root((Segurança))
    Sessão
      JWT assinado com jose
      httpOnly, SameSite=Lax
      Secure em produção
      30 dias
    Login
      Google OIDC com PKCE, state e nonce
      allowlist conferida a cada requisição
      senha comparada em tempo constante
      atraso progressivo após 5 erros
    Inicialização
      produção sem login não sobe
      exceto ALLOW_NO_AUTH=true
      AUTH_SECRET curto não sobe
      Google sem ADMIN_EMAILS não sobe
    Tokens
      MCP e feed .ics pessoais
      só o SHA-256 no banco
      usuário bloqueado perde o acesso
      sem ferramentas destrutivas no MCP
    Conteúdo
      Markdown sem HTML bruto
      links externos com noopener
      CSV protegido contra fórmulas
```

---

## 10. Servidor MCP: uma LLM como segunda "interface"

O [Model Context Protocol](https://modelcontextprotocol.io) permite que uma LLM, lendo o PDF do
edital, cadastre o concurso chamando "ferramentas". A **mesma fábrica** (`criarServidorMcp`) serve
dois transportes, e cada instância só enxerga os dados de um usuário — no stdio, o usuário inicial;
no HTTP, o dono do token pessoal gerado em **Configurações → Token do MCP** (`cmcp_…`):

```mermaid
flowchart LR
  subgraph Local
    CL1["Claude Desktop /<br/>outro cliente MCP"] -->|stdio| SC["scripts/mcp.ts<br/>pnpm --silent mcp"]
  end
  subgraph Hospedado
    CL2["Cliente MCP remoto"] -->|"HTTPS<br/>Authorization: Bearer"| RT["app/api/mcp/route.ts"]
  end
  SC --> F["criarServidorMcp({ db, usuarioId, aoAlterar })<br/>server/mcp/servidor.ts"]
  RT --> F
  F --> OP["operacoes.ts"]
  OP --> SCH["lib/schemas<br/>(mesmos da UI)"]
  OP --> Q["queries/"]
  OP --> R["repositories/"]
  OP --> DUP["domain/duplicados.ts"]
```

O que a LLM enxerga:

| Tipo | Itens |
|---|---|
| 🔧 **Ferramentas** | `listar_concursos`, `obter_concurso`, `proximos_prazos`, `verificar_duplicado`, `cadastrar_concurso`, `atualizar_concurso`, `alterar_status`, `salvar_eventos`, `salvar_links`, `registrar_resultado` |
| 📄 **Recursos** | `concurso://referencia` (enums e rótulos), `concurso://concursos/{id}` (ficha) |
| 💬 **Prompts** | `cadastrar_edital`, `aplicar_retificacao` |

Um cadastro típico:

```mermaid
sequenceDiagram
  autonumber
  actor Pessoa
  participant LLM
  participant MCP as Servidor MCP
  participant DB as SQLite

  Pessoa->>LLM: "Cadastre o cargo X deste edital" + PDF
  LLM->>MCP: verificar_duplicado(órgão, cargo)
  MCP-->>LLM: nenhum parecido (Jaccard)
  LLM->>MCP: cadastrar_concurso(dados + eventos + links + tags)
  MCP->>MCP: valida TUDO com os schemas da UI
  alt algum campo inválido
    MCP-->>LLM: isError + lista de erros ("eventos[2].data")
    LLM->>MCP: tenta de novo corrigido
  end
  MCP->>DB: uma transação: concurso + eventos + links + tags
  MCP->>MCP: aoAlterar() → revalidatePath
  MCP-->>LLM: ficha do concurso criado
  LLM-->>Pessoa: "Pronto! 7 datas cadastradas."
```

Decisões de design: **nada é excluído pelo MCP** (só pela UI), **um concurso = um cargo**,
**tudo ou nada** (transação única) e o servidor **não baixa PDFs** — quem lê o edital é a LLM.

---

## 11. Inicialização do servidor

O que acontece entre `pnpm start` e a primeira requisição:

```mermaid
sequenceDiagram
  participant N as Next.js
  participant I as instrumentation.ts
  participant Ini as server/inicializacao.ts
  participant DB as Banco

  N->>I: register()  (uma vez, runtime nodejs)
  I->>Ini: verificarAmbienteAoIniciar()
  alt produção sem login e sem ALLOW_NO_AUTH=true
    Ini-->>N: process.exit(1) 🛑
  else AUTH_SECRET curto, Google sem ADMIN_EMAILS<br/>ou Google + APP_PASSWORD em produção
    Ini-->>N: process.exit(1) 🛑
  end
  I->>Ini: migrarAoIniciar()
  opt MIGRATE_ON_START=true (Docker)
    Ini->>DB: aplica migrações pendentes
  end
  N->>N: começa a atender requisições ✅
```

E onde as migrações rodam em cada cenário:

| Comando / ambiente | Quem migra |
|---|---|
| `pnpm dev` | script `predev` → `pnpm db:migrate` |
| `pnpm build` (local, Vercel) | script `prebuild` → `pnpm db:migrate` |
| Docker | `MIGRATE_ON_START=true` → `instrumentation.ts` |
| Testes | banco `:memory:` migrado em cada suíte |

O cliente do banco (`server/db/client.ts`) é um **singleton** guardado em `globalThis`, para não abrir
uma conexão nova a cada recarga do modo dev (HMR).

---

## 12. Onde o app roda

O **mesmo código** atende três cenários; só muda a `DATABASE_URL`. Publicado em HTTPS, o app pode
ser **instalado no celular** como PWA (manifest + ícones; sem service worker).

```mermaid
flowchart TB
  subgraph A["🏠 Local (padrão)"]
    A1["pnpm dev / pnpm start"] --> A2[("data/concurso.db")]
  end
  subgraph B["☁️ Vercel + Turso (grátis)"]
    B1["Vercel Hobby<br/>(serverless)"] -->|"libsql://…<br/>DATABASE_* ou TURSO_*"| B2[("Turso")]
  end
  subgraph C["🐳 Docker (VPS / Fly.io)"]
    C1["imagem standalone<br/>usuário sem root"] --> C2[("volume /app/data")]
  end

  CODE["mesmo código"] --> A1 & B1 & C1
```

| | Local | Vercel + Turso | Docker |
|---|---|---|---|
| Custo | R$ 0 | R$ 0 | ~US$ 2–5/mês |
| Login | opcional | **obrigatório** (Google) | **obrigatório** (senha ou Google) |
| Backup | `pnpm db:backup` (`VACUUM INTO`) + JSON | restore do Turso + JSON | cópia do volume + JSON |

Backup e restauração universais, que funcionam em qualquer cenário:

```mermaid
flowchart LR
  APP1["App A<br/>(ex.: local)"] -->|"GET /api/export<br/>JSON versionado"| F["📦 backup.json<br/>schemaVersion"]
  F -->|"POST /api/import<br/>substitui tudo, numa transação"| APP2["App B<br/>(ex.: hospedado)"]
  APP1 -->|"GET /api/export?formato=csv"| CSV["📊 concursos.csv<br/>(separador ;)"]
```

---

## 13. Testes e entrega

### 13.1 A pirâmide de testes

```mermaid
flowchart TB
  E2E["🎭 E2E — Playwright<br/>login, admin, fluxo principal, calendário, quadro,<br/>lembretes, MCP, PWA, celular 360 px…<br/><i>poucos, lentos, realistas</i>"]
  INT["🔗 Integração — Vitest + libSQL :memory:<br/>repositories, queries, export→import,<br/>isolamento entre usuários, servidor MCP<br/><i>banco real em memória</i>"]
  UNI["🧪 Unitários — Vitest<br/>domain/*, lib/*, schemas Zod<br/><i>muitos, rápidos, cobertura ≥ 90% no domínio</i>"]
  E2E --- INT --- UNI

  style UNI fill:#e8f5e9,stroke:#2e7d32
  style INT fill:#fff8e1,stroke:#f9a825
  style E2E fill:#fce4ec,stroke:#ad1457
```

Os testes ficam **ao lado** do código (`status.ts` + `status.test.ts`), rodam com `TZ=UTC` para
provar que nada depende do fuso da máquina e fixam o "hoje" para serem determinísticos.

### 13.2 Fluxo de branches e CI

```mermaid
%%{init: { "gitGraph": { "mainBranchName": "master" } } }%%
gitGraph
  commit id: "v1.2.0" tag: "v1.2.0"
  branch develop
  checkout develop
  commit id: "…"
  branch feature/cor-concurso
  checkout feature/cor-concurso
  commit id: "feat: cor e ícone"
  checkout develop
  merge feature/cor-concurso id: "PR #55"
  branch release/1.3.0
  checkout release/1.3.0
  commit id: "chore(release): 1.3.0"
  checkout master
  merge release/1.3.0 id: "PR #56" tag: "v1.3.0"
  checkout develop
  merge master id: "volta p/ develop"
```

```mermaid
flowchart LR
  PR["PR / push<br/>develop ou master"] --> CHK["check<br/>biome ci → tsc → vitest --coverage → next build"]
  CHK --> E2E["e2e<br/>Playwright"]
  CHK --> DKR["docker<br/>build da imagem + smoke test"]
  PR --> POL["branch-policy<br/>PR p/ master só de release/* ou hotfix/*"]
  TAG["tag vX.Y.Z"] --> REL["release.yml<br/>GitHub Release com notas do CHANGELOG"]
```

---

## 14. Mapa de pastas e "onde mexo para…"

```mermaid
mindmap
  root((concurso))
    src/app
      grupo app: páginas com navegação
      admin/ painel admin
      login/ · manifest.ts
      api/ export · import · health · mcp
      api/ auth/google · calendario.ics
    src/components
      ui/ shadcn
      concurso/ formulários, badges, quadro
      calendario/ · dashboard/ · tema/
      admin/ · auth/ · configuracoes/
      layout/ · notificacoes/
    src/domain
      status · prazos · validade
      notificacoes · icalendar · sugestao-status
      cores · duplicados · quadro · calendario
      enums · labels · erros
    src/lib
      schemas/ Zod
      tz · format · normalize · csv
      tema · pwa · tags
    src/server
      actions/ Server Actions
      queries/ leituras
      repositories/ escritas
      db/ schema · client · migrate
      auth/ sessão · senha · Google · admin · limitador
      mcp/ servidor · operações · textos
    src/proxy.ts
    drizzle/ migrações SQL
    scripts/ migrate · seed · backup · mcp · gerar-icones
    e2e/ Playwright
```

| Quero… | Comece por |
|---|---|
| Adicionar um campo ao concurso | `server/db/schema.ts` → `pnpm db:generate` → `lib/schemas/concurso.ts` → `formulario-concurso.tsx` → `lib/schemas/backup.ts` → `mcp/entradas.ts` |
| Mudar uma regra de status | `domain/status.ts` + `domain/status.test.ts` |
| Mudar o que aparece nos prazos | `domain/prazos.ts` (regra) ou `server/queries/dashboard.ts` (dados) |
| Criar uma nova tela | `src/app/(app)/<rota>/page.tsx` + uma função em `server/queries/` |
| Criar uma nova ação de gravação | `server/repositories/` (transação) + `server/actions/` (receita da §6) |
| Expor algo para a LLM | `server/mcp/operacoes.ts` + registrar em `server/mcp/servidor.ts` |
| Mudar cores/tema | tokens em `src/app/globals.css` (`:root` e `.dark`) |
| Mudar as regras padrão dos lembretes | `domain/notificacoes.ts` (`REGRAS_PADRAO`) + teste |
| Proteger uma nova tela de admin | `src/app/admin/<rota>/page.tsx` com `exigirAdminPagina()` |
| Trocar o logo/ícones | `assets/logo.svg` → `pnpm icones` |

---

## 15. Glossário

| Termo | Significado aqui |
|---|---|
| **Server Component (RSC)** | Componente React que roda só no servidor; pode ser `async` e ler o banco direto. |
| **Client Component** | Arquivo com `"use client"`; roda no navegador (estado, eventos, diálogos). |
| **Server Action** | Função com `"use server"` chamada pelo cliente como se fosse local; o Next faz o POST por baixo. |
| **Route Handler** | `route.ts` em `app/api/…`; endpoint HTTP clássico (export, import, MCP). |
| **`proxy.ts`** | O antigo `middleware.ts` (renomeado no Next 16); roda antes de toda rota. |
| **`revalidatePath`** | Avisa o Next que uma página mudou, para ela ser renderizada de novo com dados novos. |
| **Drizzle** | ORM leve: o schema em TypeScript gera os tipos e as migrações SQL. |
| **libSQL / Turso** | Fork do SQLite com driver que fala com arquivo local **ou** com um banco remoto. |
| **Zod** | Biblioteca de schemas: valida dados e infere o tipo TypeScript. |
| **MCP** | Model Context Protocol: padrão para uma LLM chamar ferramentas de um app. |
| **`ErroDominio`** | Exceção de regra de negócio; vira mensagem amigável ao usuário (ou à LLM). |
| **Pseudo-evento de validade** | Prazo calculado (não gravado) a partir da homologação + meses de validade. |
| **Usuário inicial** | Usuário de ID 1, dono dos dados no uso local (sem login ou com senha única); assumido pelo primeiro admin que entra com Google. |
| **Feed .ics** | Calendário no formato iCalendar que apps como o Google Calendar assinam por URL e sincronizam sozinhos. |
| **PWA** | *Progressive Web App*: o site pode ser instalado no celular e abre em tela cheia, como um app. |
