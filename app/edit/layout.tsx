import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Image Editor",
  description:
    "Annotate photos with pixelate, shapes, text, and brush tools. Editing runs in your browser.",
};

export default function EditLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
