import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Checkbox({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={cn("h-5 w-5 rounded-md border-slate-300 text-emerald-600 accent-emerald-600 focus:ring-emerald-500", className)}
      {...props}
    />
  );
}
