import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { BotaoGoogle } from "@/components/auth/botao-google";
import { FormularioLogin } from "@/components/auth/formulario-login";
import { Marca } from "@/components/layout/marca";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usuarioAtual } from "@/server/auth/acesso";
import { lerConfigAuth } from "@/server/auth/config";
import { type ErroLogin, MENSAGENS_ERRO_LOGIN } from "@/server/auth/login-google";
import { destinoSeguro } from "@/server/auth/sessao";

export const metadata: Metadata = { title: "Entrar" };

const primeiro = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  await connection();
  const config = lerConfigAuth();
  if (!config.habilitada) redirect("/");
  const params = await searchParams;
  const para = destinoSeguro(primeiro(params.para));
  // Já autenticado (sessão válida e ainda autorizada): volta para o app.
  if (await usuarioAtual()) redirect(para);

  const codigoErro = primeiro(params.erro);
  const erro =
    codigoErro && codigoErro in MENSAGENS_ERRO_LOGIN
      ? MENSAGENS_ERRO_LOGIN[codigoErro as ErroLogin]
      : null;
  const comGoogle = config.google !== null;
  const comSenha = config.senha !== null;

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-4">
          <Marca />
          <div className="space-y-1.5">
            <CardTitle>Entrar</CardTitle>
            <CardDescription>
              {comGoogle
                ? "Entre com a sua conta Google para acessar seus concursos."
                : "Informe a senha para acessar seus concursos."}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {erro ? (
            <p role="alert" className="text-destructive text-sm">
              {erro}
            </p>
          ) : null}
          {comGoogle ? <BotaoGoogle para={para} /> : null}
          {comGoogle && comSenha ? (
            <p className="text-center text-muted-foreground text-xs">ou, neste ambiente local</p>
          ) : null}
          {comSenha ? <FormularioLogin para={para} /> : null}
        </CardContent>
      </Card>
    </main>
  );
}
