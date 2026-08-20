import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Image Converter",
  description:
    "Convert images between JPG, PNG, WebP, GIF, BMP, TIFF, and HEIC in your browser. Batch conversion with ZIP download.",
};

export default function ConvertLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}