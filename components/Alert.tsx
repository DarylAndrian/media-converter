import type { ReactNode } from "react";
import { CheckIcon, ErrorIcon, InfoIcon, WarningIcon } from "@/components/icons";

type Tone = "info" | "success" | "warning" | "error";

interface AlertProps {
  tone?: Tone;
  title?: string;
  children: ReactNode;
}

const TONE_CLASSES: Record<Tone, { box: string; icon: string }> = {
  info: {
    box: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200",
    icon: "text-sky-600 dark:text-sky-400",
  },
  success: {
    box: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
    icon: "text-emerald-600 dark:text-emerald-400",
  },
  warning: {
    box: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
    icon: "text-amber-600 dark:text-amber-400",
  },
  error: {
    box: "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200",
    icon: "text-red-600 dark:text-red-400",
  },
};

const TONE_ICON: Record<Tone, typeof InfoIcon> = {
  info: InfoIcon,
  success: CheckIcon,
  warning: WarningIcon,
  error: ErrorIcon,
};

export function Alert({ tone = "info", title, children }: AlertProps) {
  const Icon = TONE_ICON[tone];
  const { box, icon } = TONE_CLASSES[tone];

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm leading-6 ${box}`}
    >
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${icon}`} />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        <p>{children}</p>
      </div>
    </div>
  );
}