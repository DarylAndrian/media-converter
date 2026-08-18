"use client";

import { useEffect, useState } from "react";
import { EditorMockup } from "@/components/image-editor/EditorMockup";

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
    <div className="relative min-h-full overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.25),_transparent_45%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.18),_transparent_35%)]" />

      <main className="relative mx-auto flex min-h-full w-full max-w-5xl flex-col px-6 py-12 sm:px-8 sm:py-16">
        <header className="mb-10 text-center sm:text-left">
          <p className="mb-3 inline-flex rounded-full border border-indigo-400/30 bg-indigo-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-200">
            Image Editor
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Annotate photos like LINE
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
            Pixelate, draw shapes, add text, or brush over a photo. Editing runs in
            your browser — download a PNG when you are done.
          </p>
        </header>

        <section className="rounded-3xl border border-white/10 bg-white/95 p-6 text-slate-900 shadow-2xl shadow-indigo-950/30 backdrop-blur sm:p-8">
          <EditorMockup
            file={file}
            previewUrl={previewUrl}
            onFilesChange={handleFilesChange}
            onClear={() => setFile(null)}
          />
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            {
              title: "Pixelate & blur",
              body: "Hide names, numbers, or faces with mosaic blocks or a frosted blur — same idea as LINE’s privacy tools.",
            },
            {
              title: "Shape, text, brush",
              body: "Highlight a region, drop a caption, or sketch with a pen or highlighter. Options sit above the tool dock.",
            },
            {
              title: "Stays in the browser",
              body: "Photos are annotated locally like the rest of Media Converter. Nothing is uploaded to edit.",
            },
          ].map((item) => (
            <article
              key={item.title}
              className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur"
            >
              <h2 className="text-sm font-semibold text-white">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">{item.body}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
