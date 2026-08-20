import type { ReactNode } from "react";

interface Feature {
  title: string;
  body: string;
}

interface ToolShellProps {
  eyebrow: string;
  title: string;
  description: string;
  features?: Feature[];
  children: ReactNode;
  className?: string;
}

function renderTitle(title: string) {
  const parts = title.split("*");
  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <em
        key={index}
        className="font-display font-normal italic text-accent"
      >
        {part}
      </em>
    ) : (
      <span key={index}>{part}</span>
    ),
  );
}

export function ToolShell({
  eyebrow,
  title,
  description,
  features,
  children,
  className = "",
}: ToolShellProps) {
  return (
    <main
      className={`mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14 ${className}`}
    >
      <header className="mb-8 sm:mb-10">
        <p className="mb-3 font-mono text-xs font-medium tracking-[0.18em] text-accent uppercase">
          {eyebrow}
        </p>
        <h1 className="text-balance text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          {renderTitle(title)}
        </h1>
        {description && (
          <p className="mt-3 max-w-2xl text-balance text-base leading-7 text-mut">
            {description}
          </p>
        )}
      </header>

      {children}

      {features && (
        <section className="mt-10 grid gap-3 sm:grid-cols-3">
          {features.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </section>
      )}
    </main>
  );
}

export function FeatureCard({ title, body }: Feature) {
  return (
    <article className="rounded-xl border border-line bg-surface px-4 py-4">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      <p className="mt-1.5 text-sm leading-6 text-mut">{body}</p>
    </article>
  );
}