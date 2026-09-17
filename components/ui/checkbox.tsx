import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Checkbox({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={cn("h-5 w-5 rounded-md border-slate-300 text-[#e9a227] accent-[#e9a227] focus:ring-[#e9a227]", className)}
      {...props}
    />
  );
}
