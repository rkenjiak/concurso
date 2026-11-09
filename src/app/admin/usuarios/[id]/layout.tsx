import { conferirUsuario } from "./carregar";

/**
 * Confere o usuário antes do `loading.tsx` do detalhe (#110), como o `forbidden()` do
 * `admin/layout.tsx`: abaixo do fallback, o `notFound()` sairia com status 200.
 */
export default async function UsuarioAdminLayout({
  children,
  params,
}: LayoutProps<"/admin/usuarios/[id]">) {
  await conferirUsuario((await params).id);
  return children;
}
