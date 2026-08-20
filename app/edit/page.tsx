"use client";

import { useEffect, useState } from "react";
import { EditorMockup } from "@/components/image-editor/EditorMockup";
import { ToolShell } from "@/components/ToolShell";

export default function EditPage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const handleFilesChange = (files: File[]) => {
    setFile(files[0] ?? null);
  };

  return (
    <ToolShell
      eyebrow="Image Editor"
      title="Annotate photos*right in the browser*"
      description="Pixelate, draw shapes, add text, or brush over a photo. Everything runs locally — download a PNG when you are done."
      features={[
        {
          title: "Pixelate & blur",
          body: "Hide names, numbers, or faces with mosaic blocks or a frosted blur.",
        },
        {
          title: "Shape, text, brush",
          body: "Highlight a region, drop a caption, or sketch with a pen or highlighter. Options sit above the tool dock.",
        },
        {
          title: "Stays in the browser",
          body: "Photos are annotated locally like the rest of Media Converter. Nothing is uploaded to edit.",
        },
      ]}
    >
      <section className="rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-6">
        <EditorMockup
          file={file}
          previewUrl={previewUrl}
          onFilesChange={handleFilesChange}
          onClear={() => setFile(null)}
        />
      </section>
    </ToolShell>
  );
}