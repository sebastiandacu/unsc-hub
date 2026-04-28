"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";

/**
 * Renders Tiptap JSON read-only. Falls back to plain-text rendering when
 * passed a `{type:"plain", content:"..."}` legacy bulletin/event/thread body.
 */
export function RichRenderer({ doc }: { doc: unknown }) {
  const isLegacyPlain =
    !!doc &&
    typeof doc === "object" &&
    (doc as { type?: string }).type === "plain";

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Image.configure({ HTMLAttributes: { class: "rounded-sm border border-[var(--color-border)] my-2 max-w-full" } }),
      Link.configure({ openOnClick: true, HTMLAttributes: { class: "text-[var(--color-accent)] underline", target: "_blank", rel: "noreferrer" } }),
    ],
    content: isLegacyPlain ? null : (doc as object | null) ?? null,
    editable: false,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "prose-rich font-mono text-sm leading-relaxed",
      },
    },
  });

  if (isLegacyPlain) {
    const content = (doc as { content?: string }).content ?? "";
    return <div className="font-mono text-sm whitespace-pre-line leading-relaxed">{content}</div>;
  }
  if (!editor) return null;
  return <EditorContent editor={editor} />;
}
