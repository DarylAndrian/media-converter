import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Video Converter",
  description:
    "Convert videos between MP4, MOV, AVI, MKV, and WEBM formats in your browser.",
};

export default function VideoLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
