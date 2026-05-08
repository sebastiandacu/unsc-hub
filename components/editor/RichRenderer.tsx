"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";

/**
 * Strip image nodes whose src is empty / non-string and replace them with
 * a visible placeholder paragraph so old broken posts don't render as
 * silent gaps. New posts can't get into this state anymore (the action
 * rejects them) but legacy ones already in the DB need a graceful render.
 */
function patchBrokenImages(doc: unknown): unknown {
  if (!doc || typeof doc !== "object") return doc;
  const node = doc as {
    type?: string;
    attrs?: { src?: unknown };
    content?: unknown[];
  };
  if (Array.isArray(node.content)) {
    node.content = node.content.map((c) => {
      const child = c as { type?: string; attrs?: { src?: unknown } };
      if (child.type === "image") {
        const src = typeof child.attrs?.src === "string" ? child.attrs.src.trim() : "";
        if (!src) {
          return {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "[ imagen sin URL — re-subila desde el botón 📷 del editor ]",
                marks: [{ type: "italic" }],
              },
            ],
          };
        }
      }
      return patchBrokenImages(c);
    });
  }
  return node;
}

/**
 * Renders Tiptap JSON read-only. Falls back to plain-text rendering when
 * passed a `{type:"plain", content:"..."}` legacy bulletin/event/thread body.
 */
export function RichRenderer({ doc }: { doc: unknown }) {
  const isLegacyPlain =
    !!doc &&
    typeof doc === "object" &&
    (doc as { type?: string }).type === "plain";

  const cleaned = isLegacyPlain ? doc : patchBrokenImages(doc);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Image.configure({ HTMLAttributes: { class: "rounded-sm border border-[var(--color-border)] my-2 max-w-full" } }),
      Link.configure({ openOnClick: true, HTMLAttributes: { class: "text-[var(--color-accent)] underline", target: "_blank", rel: "noreferrer" } }),
    ],
    content: isLegacyPlain ? null : (cleaned as object | null) ?? null,
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
