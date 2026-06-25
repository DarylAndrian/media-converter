import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Image Compressor",
  description:
    "Compress images (JPG, PNG, WebP, GIF, BMP, TIFF, HEIC) to any target size. Iterative quality + resize loop, batch support, ZIP download.",
};

export default function CompressLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
