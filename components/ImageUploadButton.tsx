"use client";

import { useRef, useState } from "react";
import { useUploadThing } from "@/lib/uploadthing";
import type { OurFileRouter } from "@/app/api/uploadthing/core";

type Endpoint = keyof OurFileRouter;

export function ImageUploadButton({
  endpoint,
  onUploaded,
  label = "Subir imagen",
  disabled = false,
  accept = "image/*",
}: {
  endpoint: Endpoint;
  onUploaded: (url: string, meta?: { mediaType?: "image" | "video" }) => void;
  label?: string;
  disabled?: boolean;
  accept?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const { startUpload, isUploading } = useUploadThing(endpoint, {
    onClientUploadComplete: (res) => {
      const first = res?.[0];
      const url = first?.serverData?.url ?? first?.ufsUrl;
      const sd = first?.serverData as { mediaType?: "image" | "video" } | undefined;
      const mediaType =
        sd?.mediaType ??
        (first?.type?.startsWith("video/") ? "video" : first?.type?.startsWith("image/") ? "image" : undefined);
      if (url) onUploaded(url, { mediaType });
      setError(null);
    },
    onUploadError: (e) => setError(e.message),
  });

  return (
    <div className="inline-flex flex-col gap-1">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) startUpload(files);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={disabled || isUploading}
        onClick={() => inputRef.current?.click()}
        className="btn"
      >
        {isUploading ? "Subiendo..." : label}
      </button>
      {error && <span className="label-mono text-[var(--color-danger)]">{error}</span>}
    </div>
  );
}
