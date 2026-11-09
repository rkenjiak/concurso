import { carregarConcurso } from "./carregar";

/**
 * Confere o concurso antes do `loading.tsx` do detalhe (#110): o stream começa no fallback, e daí
 * em diante o status HTTP fica fixado em 200. Aqui, acima dele, o `notFound()` ainda sai 404. As
 * páginas carregam de novo (o layout não é reexecutado entre o detalhe e a edição); na mesma
 * renderização, o `cache` reaproveita a consulta.
 */
export default async function ConcursoLayout({ children, params }: LayoutProps<"/concursos/[id]">) {
  await carregarConcurso((await params).id);
  return children;
}
