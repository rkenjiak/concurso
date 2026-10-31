import { Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function ListaTags({ tags }: { tags: readonly string[] }) {
  if (tags.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1" aria-label="Tags">
      {tags.map((t) => (
        <li key={t}>
          <Badge variant="outline">
            <Tag aria-hidden />
            {t}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
