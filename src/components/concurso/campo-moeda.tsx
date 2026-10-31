"use client";

import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { mascararBRL } from "@/lib/format";

type CampoMoedaProps = Omit<ComponentProps<typeof Input>, "onChange" | "value" | "type"> & {
  value: string;
  onChange: (valor: string) => void;
};

/** Campo de moeda com máscara "R$ 1.234,56" (o valor do formulário fica sem o "R$"). */
export function CampoMoeda({ value, onChange, ...props }: CampoMoedaProps) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground text-sm">
        R$
      </span>
      <Input
        {...props}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="0,00"
        className="pl-9 text-right tabular-nums"
        value={value}
        onChange={(e) => onChange(mascararBRL(e.target.value))}
      />
    </div>
  );
}
