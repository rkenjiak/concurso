import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { FormularioLogin } from "@/components/auth/formulario-login";
import { Marca } from "@/components/layout/marca";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { lerConfigAuth } from "@/server/auth/config";
import { destinoSeguro } from "@/server/auth/sessao";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  await connection();
  if (!lerConfigAuth().habilitada) redirect("/");
  const { para } = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-4">
          <Marca />
          <div className="space-y-1.5">
            <CardTitle>Entrar</CardTitle>
            <CardDescription>Informe a senha para acessar seus concursos.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <FormularioLogin para={destinoSeguro(Array.isArray(para) ? para[0] : para)} />
        </CardContent>
      </Card>
    </main>
  );
}
