import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logout } from "@/server/actions/auth";

/** Encerra a sessão (formulário com Server Action, funciona sem JavaScript). */
export function BotaoSair() {
  return (
    <form action={logout}>
      <Button type="submit" variant="outline">
        <LogOut aria-hidden />
        Sair
      </Button>
    </form>
  );
}
