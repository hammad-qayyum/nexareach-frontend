"use client";

import { Placeholder } from "@tiptap/extension-placeholder";
import { EditorContent, type Editor, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { BoldIcon, ItalicIcon, LinkIcon, ListIcon, ListOrderedIcon, RemoveFormattingIcon, UnderlineIcon } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Rich text for email bodies. Only formatting that survives in mail apps: bold, italic, underline,
 * links and lists. The server cleans the HTML again before it's saved or sent.
 */
export function RichEditor({
  id,
  value,
  onChange,
  onReady,
  onFocus,
  placeholder,
}: {
  id?: string;
  value: string;
  onChange: (html: string) => void;
  onReady?: (editor: Editor) => void;
  onFocus?: () => void;
  placeholder?: string;
}) {
  const editor = useEditor({
    // Rendered in the browser only; avoids a server/client mismatch.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        blockquote: false,
        link: { openOnClick: false, autolink: true, protocols: ["http", "https", "mailto"] },
      }),
      Placeholder.configure({ placeholder: placeholder ?? "" }),
    ],
    content: value,
    editorProps: {
      attributes: {
        ...(id ? { id } : {}),
        class: "rich-editor min-h-64 px-3 py-2 text-sm leading-relaxed outline-none",
        "aria-multiline": "true",
        role: "textbox",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    onFocus: () => onFocus?.(),
  });

  useEffect(() => {
    if (editor) onReady?.(editor);
  }, [editor, onReady]);

  return (
    <div className="overflow-hidden rounded-lg border border-input focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30">
      {editor && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      link: e.isActive("link"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
    }),
  });

  function setLink() {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link address (https://…)", previous ?? "https://");
    if (url === null) return;
    if (url.trim() === "" || url.trim() === "https://") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }

  const buttons = [
    { label: "Bold", icon: BoldIcon, active: state.bold, run: () => editor.chain().focus().toggleBold().run() },
    { label: "Italic", icon: ItalicIcon, active: state.italic, run: () => editor.chain().focus().toggleItalic().run() },
    {
      label: "Underline",
      icon: UnderlineIcon,
      active: state.underline,
      run: () => editor.chain().focus().toggleUnderline().run(),
    },
    { label: "Link", icon: LinkIcon, active: state.link, run: setLink },
    {
      label: "Bulleted list",
      icon: ListIcon,
      active: state.bullet,
      run: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      label: "Numbered list",
      icon: ListOrderedIcon,
      active: state.ordered,
      run: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      label: "Clear formatting",
      icon: RemoveFormattingIcon,
      active: false,
      run: () => editor.chain().focus().unsetAllMarks().clearNodes().run(),
    },
  ];

  return (
    <div className="flex flex-wrap gap-0.5 border-b bg-muted/40 p-1" role="toolbar" aria-label="Formatting">
      {buttons.map((b) => (
        <Tooltip key={b.label}>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={b.label}
              aria-pressed={b.active}
              className={cn(b.active && "bg-accent text-accent-foreground")}
              onMouseDown={(e) => e.preventDefault()}
              onClick={b.run}
            >
              <b.icon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{b.label}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

/** Plain text (as typed in the plain editor) to the HTML the rich editor starts from. */
export function textToHtml(text: string): string {
  const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return text
    .split(/\n{2,}/)
    .map((p) => `<p>${escape(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}
