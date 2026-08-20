import type { Metadata } from "next";
import { AppNav } from "@/components/AppNav";
import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Media Converter",
    template: "%s | Media Converter",
  },
  description:
    "Convert, compress, and edit images and video in your browser. Free, fast, and private.",
  icons: {
    icon: "/logo.webp",
  },
};

const themeScript = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    var dark = stored === "dark" || (!stored && matchMedia("(prefers-color-scheme: dark)").matches);
    if (dark) document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fontVariables} h-full antialiased`}
    >
      <body className="min-h-full bg-bg font-sans text-ink">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <AppNav />
        {children}
      </body>
    </html>
  );
}