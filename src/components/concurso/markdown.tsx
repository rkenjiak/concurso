import ReactMarkdown, { type Components } from "react-markdown";

const componentes: Components = {
  a: ({ node: _node, ...props }) => (
    <a
      {...props}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-4"
    />
  ),
};

/**
 * Renderiza markdown com segurança: HTML bruto é descartado (`skipHtml`) e URLs perigosas
 * (`javascript:` etc.) são neutralizadas pelo `urlTransform` padrão do react-markdown.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_h1]:font-semibold [&_h1]:text-lg [&_h2]:font-semibold [&_h2]:text-base [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5">
      <ReactMarkdown skipHtml components={componentes}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
