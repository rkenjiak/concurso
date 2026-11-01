import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

// Estilos usam apenas tokens do tema (border, muted, …) para acompanhar claro/escuro.
const componentes: Components = {
  a: ({ node: _node, ...props }) => (
    <a
      {...props}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-4"
    />
  ),
  // Tabelas largas rolam na horizontal dentro do próprio wrapper, sem quebrar o layout.
  table: ({ node: _node, ...props }) => (
    <div className="overflow-x-auto rounded-md border border-border">
      <table {...props} className="w-full border-collapse text-left text-sm" />
    </div>
  ),
  thead: ({ node: _node, ...props }) => <thead {...props} className="bg-muted" />,
  th: ({ node: _node, ...props }) => (
    <th
      {...props}
      className="border-b border-border px-3 py-2 font-semibold whitespace-nowrap text-foreground"
    />
  ),
  td: ({ node: _node, ...props }) => (
    <td {...props} className="border-t border-border px-3 py-2 align-top" />
  ),
};

/**
 * Renderiza markdown com segurança: HTML bruto é descartado (`skipHtml`) e URLs perigosas
 * (`javascript:` etc.) são neutralizadas pelo `urlTransform` padrão do react-markdown.
 * Suporta as extensões GFM (`remark-gfm`): tabelas, tachado, listas de tarefas e autolinks.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_h1]:font-semibold [&_h1]:text-lg [&_h2]:font-semibold [&_h2]:text-base [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5">
      <ReactMarkdown skipHtml remarkPlugins={[remarkGfm]} components={componentes}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
