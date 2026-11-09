import { conferirConcurso } from "./carregar";

/**
 * Confere o concurso antes do `loading.tsx` do detalhe (#110): o stream começa no fallback, e daí
 * em diante o status HTTP fica fixado em 200. Aqui, acima dele, o `notFound()` ainda sai 404.
 */
export default async function ConcursoLayout({ children, params }: LayoutProps<"/concursos/[id]">) {
  await conferirConcurso((await params).id);
  return children;
}
