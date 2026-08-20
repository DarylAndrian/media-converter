import Link from "next/link";
import {
  ArrowUpRightIcon,
  AudioIcon,
  CompressIcon,
  EditIcon,
  EraserIcon,
  ImageIcon,
  VideoIcon,
} from "@/components/icons";

const TOOLS = [
  {
    href: "/convert",
    label: "Image Converter",
    description: "Convert JPG, PNG, WebP, GIF, BMP, TIFF, and HEIC. Single file or batch to ZIP.",
    icon: ImageIcon,
  },
  {
    href: "/compress",
    label: "Compress",
    description: "Shrink images to a target size with an iterative quality and resize loop.",
    icon: CompressIcon,
  },
  {
    href: "/video",
    label: "Video Converter",
    description: "Convert MP4, MOV, AVI, MKV, and WEBM with ffmpeg running in your browser.",
    icon: VideoIcon,
  },
  {
    href: "/video-to-audio",
    label: "Video to Audio",
    description: "Extract audio from videos as MP3, WAV, M4A, OGG, FLAC, or OPUS.",
    icon: AudioIcon,
  },
  {
    href: "/remove-background",
    label: "Background Remover",
    description: "AI-powered subject cutout with fast and high-quality edge refinement.",
    icon: EraserIcon,
  },
  {
    href: "/edit",
    label: "Image Editor",
    description: "Annotate photos with pixelate, shapes, text, and brush tools.",
    icon: EditIcon,
  },
] as const;

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-14 sm:px-8 sm:py-20">
      <header className="mb-10 text-center sm:mb-14 sm:text-left">
        <p className="mb-3 font-mono text-xs font-medium tracking-[0.18em] text-accent uppercase">
          Media Converter
        </p>
        <h1 className="max-w-3xl text-balance text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
          Convert, compress, and{" "}
          <em className="font-display font-normal italic text-accent">clean up</em>{" "}
          media — right in your browser
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-balance text-base leading-7 text-mut sm:mx-0">
          Six lightweight tools for images and video. Files are processed locally
          with no uploads, no accounts, and no size limits — except your browser&apos;s
          memory.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="group flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-card transition hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-card-hover"
          >
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <tool.icon className="h-5 w-5" strokeWidth={1.8} />
              </div>
              <ArrowUpRightIcon className="h-4 w-4 text-mut transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-accent" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-ink">{tool.label}</h2>
              <p className="mt-1.5 text-sm leading-6 text-mut">{tool.description}</p>
            </div>
          </Link>
        ))}
      </section>

      <p className="mt-10 text-center font-mono text-xs text-mut sm:text-left">
        All processing runs locally — your files never leave this device.
      </p>
    </main>
  );
}