import type { ButtonHTMLAttributes } from "react";
import { SpinnerIcon } from "@/components/icons";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-accent text-on-accent hover:bg-accent-strong disabled:bg-line disabled:text-mut",
  secondary:
    "border border-line-strong bg-surface text-ink hover:bg-surface-2 disabled:text-mut disabled:hover:bg-surface",
  ghost:
    "text-mut hover:bg-surface-2 hover:text-ink disabled:text-mut/60 disabled:hover:bg-transparent",
  danger:
    "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/70",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-9 rounded-lg px-3 text-xs gap-1.5",
  md: "h-11 rounded-xl px-5 text-sm gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center font-semibold transition select-none disabled:cursor-not-allowed ${SIZE_CLASSES[size]} ${VARIANT_CLASSES[variant]} ${className ?? ""}`}
      {...props}
    >
      {loading && <SpinnerIcon className="h-4 w-4" />}
      {children}
    </button>
  );
}