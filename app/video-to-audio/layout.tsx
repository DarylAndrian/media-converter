import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Video to Audio Converter",
  description:
    "Extract audio tracks from MP4, MOV, AVI, MKV, and WEBM videos. Export as MP3, WAV, M4A, OGG, FLAC, or OPUS. All processing happens in your browser.",
};

export default function VideoToAudioLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
