"use client";

import { useClipboardCopyWithUndo } from "@/lib/use-clipboard-copy-with-undo";

export function IngredientsCopyReadOnly({ text }: { text: string }) {
  const { copied, copy, undo } = useClipboardCopyWithUndo(text);

  return (
    <section className="mb-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">Ingredients</h3>
        <div className="flex flex-wrap items-center gap-2">
          {copied ? (
            <>
              <span className="text-xs font-medium text-[#1e8449]">
                Copied to clipboard
              </span>
              <button
                type="button"
                className="rounded border border-[#7dcea0] bg-white px-2 py-1 text-xs font-medium text-[#1e8449] hover:bg-[#eafaf1]"
                onClick={() => void undo()}
              >
                Undo
              </button>
            </>
          ) : null}
          <button
            type="button"
            disabled={copied}
            className="rounded border border-[#d2c2af] bg-white px-2 py-1 text-xs font-medium hover:bg-[#f6efe9] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => void copy().catch(() => {})}
          >
            Copy
          </button>
        </div>
      </div>
      <div
        className={`rounded border p-4 text-sm transition-colors duration-200 ${
          copied
            ? "border-[#c5dcc0] bg-[#f4faf3]"
            : "border-[#e0d4c7] bg-[#fffdf8]"
        }`}
      >
        <pre
          className={`whitespace-pre-wrap transition-opacity duration-200 ${
            copied ? "opacity-45" : "opacity-100"
          }`}
        >
          {text}
        </pre>
      </div>
    </section>
  );
}
