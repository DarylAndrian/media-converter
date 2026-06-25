"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Image" },
  { href: "/compress", label: "Compress" },
  { href: "/video", label: "Video" },
  { href: "/video-to-audio", label: "Video to Audio" },
  { href: "/remove-background", label: "Background Remover" },
] as const;

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="relative z-10 border-b border-white/10 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center gap-1 px-6 py-3 sm:px-8">
        <Link
          href="/"
          className="mr-4 flex items-center gap-2 text-sm font-semibold tracking-tight text-white"
        >
          <Image
            src="/logo.webp"
            alt="Media Converter Logo"
            width={24}
            height={24}
            className="rounded-lg"
          />
          <span>Media Converter</span>
        </Link>
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-indigo-500/20 text-indigo-200"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
