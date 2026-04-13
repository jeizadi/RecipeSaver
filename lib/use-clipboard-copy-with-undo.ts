import { useCallback, useRef, useState } from "react";

export type ClipboardCopyState = {
  /** True after a successful copy until Undo or clear */
  copied: boolean;
  copy: () => Promise<void>;
  /** Restore previous clipboard contents when possible; always clears the “copied” UI */
  undo: () => Promise<void>;
  /** Clear highlight without touching the clipboard (e.g. ingredients text changed) */
  dismiss: () => void;
};

/**
 * Copy `text` to the system clipboard, with optional Undo that tries to write back
 * whatever was on the clipboard immediately before this copy (best-effort; read may
 * fail without permission).
 */
export function useClipboardCopyWithUndo(text: string): ClipboardCopyState {
  const [copied, setCopied] = useState(false);
  const priorRef = useRef<string | null>(null);

  const copy = useCallback(async () => {
    let prior: string | null = null;
    try {
      prior = await navigator.clipboard.readText();
    } catch {
      prior = null;
    }
    try {
      await navigator.clipboard.writeText(text);
      priorRef.current = prior;
      setCopied(true);
    } catch {
      throw new Error("CLIPBOARD_WRITE_FAILED");
    }
  }, [text]);

  const undo = useCallback(async () => {
    const prior = priorRef.current;
    priorRef.current = null;
    setCopied(false);
    if (prior != null) {
      try {
        await navigator.clipboard.writeText(prior);
      } catch {
        // ignore — UI already cleared
      }
    }
  }, []);

  const dismiss = useCallback(() => {
    priorRef.current = null;
    setCopied(false);
  }, []);

  return { copied, copy, undo, dismiss };
}
