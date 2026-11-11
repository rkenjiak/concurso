/**
 * Seleção em massa de uma lista (caixa de entrada de feedback, #117), em funções puras sobre um
 * conjunto imutável de IDs: marcar um item, um intervalo (Shift+clique) e todos os visíveis.
 */

/**
 * Marca (ou desmarca) `id`. Com `ancora` (último item clicado) presente em `ordem`, aplica o mesmo
 * estado a todo o intervalo entre os dois, inclusive — como o Shift+clique de um gerenciador de
 * arquivos.
 */
export function marcarItem(
  selecionados: ReadonlySet<number>,
  ordem: readonly number[],
  id: number,
  marcar: boolean,
  ancora: number | null = null,
): Set<number> {
  const novo = new Set(selecionados);
  const fim = ordem.indexOf(id);
  const inicio = ancora === null ? -1 : ordem.indexOf(ancora);
  const intervalo =
    inicio >= 0 && fim >= 0 ? ordem.slice(Math.min(inicio, fim), Math.max(inicio, fim) + 1) : [id];
  for (const item of intervalo) {
    if (marcar) novo.add(item);
    else novo.delete(item);
  }
  return novo;
}

/** Estado do checkbox do cabeçalho: todos, nenhum ou parte dos visíveis. */
export function estadoTodos(
  selecionados: ReadonlySet<number>,
  visiveis: readonly number[],
): boolean | "indeterminate" {
  const marcados = visiveis.filter((id) => selecionados.has(id)).length;
  if (marcados === 0 || visiveis.length === 0) return false;
  return marcados === visiveis.length ? true : "indeterminate";
}

/** Checkbox do cabeçalho: com todos marcados, desmarca os visíveis; senão marca todos. */
export function alternarTodos(
  selecionados: ReadonlySet<number>,
  visiveis: readonly number[],
): Set<number> {
  const novo = new Set(selecionados);
  const todos = estadoTodos(selecionados, visiveis) === true;
  for (const id of visiveis) {
    if (todos) novo.delete(id);
    else novo.add(id);
  }
  return novo;
}

/** Mantém só os IDs ainda visíveis (após filtrar, paginar ou concluir uma ação). */
export function somenteVisiveis(
  selecionados: ReadonlySet<number>,
  visiveis: readonly number[],
): Set<number> {
  return new Set(visiveis.filter((id) => selecionados.has(id)));
}
