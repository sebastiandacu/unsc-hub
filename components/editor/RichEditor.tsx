"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { useCallback, useEffect } from "react";
import { ImageUploadButton } from "@/components/ImageUploadButton";

export type RichDoc = object;

export function RichEditor({
  value,
  onChange,
  placeholder = "Write...",
  imageEndpoint = "postImage",
}: {
  value: RichDoc | null;
  onChange: (json: RichDoc) => void;
  placeholder?: string;
  imageEndpoint?: "postImage" | "threadImage";
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Image.configure({ HTMLAttributes: { class: "rounded-sm border border-[var(--color-border)] my-2 max-w-full" } }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-[var(--color-accent)] underline" } }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || { type: "doc", content: [{ type: "paragraph" }] },
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "prose-rich min-h-[200px] focus:outline-none px-3 py-2 font-mono text-sm",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
  });

  // Resync if value changes from outside (rare).
  useEffect(() => {
    if (!editor || !value) return;
    const current = JSON.stringify(editor.getJSON());
    const incoming = JSON.stringify(value);
    if (current !== incoming) editor.commands.setContent(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  const insertImage = useCallback(
    (url: string) => editor?.chain().focus().setImage({ src: url }).run(),
    [editor],
  );

  const setLink = useCallback(() => {
    if (!editor) return;
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL", previous || "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="border border-[var(--color-border)] bg-[var(--color-base)]">
      <Toolbar editor={editor} setLink={setLink} insertImage={insertImage} imageEndpoint={imageEndpoint} />
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({
  editor,
  setLink,
  insertImage,
  imageEndpoint,
}: {
  editor: Editor;
  setLink: () => void;
  insertImage: (url: string) => void;
  imageEndpoint: "postImage" | "threadImage";
}) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-[var(--color-border)] p-2 bg-[var(--color-panel)]/40">
      <BtnGroup>
        <Btn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>B</Btn>
        <Btn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>I</Btn>
        <Btn active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>S</Btn>
        <Btn active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()}>{"</>"}</Btn>
      </BtnGroup>
      <BtnGroup>
        <Btn active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</Btn>
        <Btn active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</Btn>
        <Btn active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</Btn>
      </BtnGroup>
      <BtnGroup>
        <Btn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>•</Btn>
        <Btn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1.</Btn>
        <Btn active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>“”</Btn>
        <Btn active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>{"{}"}</Btn>
        <Btn onClick={() => editor.chain().focus().setHorizontalRule().run()}>—</Btn>
      </BtnGroup>
      <BtnGroup>
        <Btn active={editor.isActive("link")} onClick={setLink}>link</Btn>
      </BtnGroup>
      <BtnGroup>
        <ImageUploadButton endpoint={imageEndpoint} onUploaded={insertImage} label="+ image" />
      </BtnGroup>
      <BtnGroup>
        <Btn onClick={() => editor.chain().focus().undo().run()}>↶</Btn>
        <Btn onClick={() => editor.chain().focus().redo().run()}>↷</Btn>
      </BtnGroup>
    </div>
  );
}

function BtnGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-px border border-[var(--color-border)] mr-1">{children}</div>;
}

function Btn({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2 py-1 font-mono text-xs ${active ? "bg-[var(--color-accent)]/20 text-[var(--color-accent)]" : "hover:bg-[var(--color-base)]"}`}
    >
      {children}
    </button>
  );
}
