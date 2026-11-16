"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Copy text to the clipboard. The Clipboard API only works on secure pages (https or localhost), so on a
 * plain-http page fall back to selecting a hidden textarea and the browser's copy command. The textarea
 * goes inside `container` so a dialog's focus trap doesn't block it.
 */
async function copyText(value: string, container: HTMLElement): Promise<boolean> {
  if (window.isSecureContext && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Fall through to the fallback.
    }
  }
  const area = document.createElement("textarea");
  area.value = value;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.top = "0";
  area.style.opacity = "0";
  container.appendChild(area);
  area.focus();
  area.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      onClick={async (e) => {
        const button = e.currentTarget;
        if (await copyText(value, button.parentElement ?? document.body)) {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } else {
          toast.error("Couldn't copy. Select the text and press Ctrl+C (⌘C on a Mac).");
        }
        button.focus();
      }}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </Button>
  );
}
