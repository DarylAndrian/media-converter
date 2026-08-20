interface ProgressBarProps {
  value?: number | null;
  label?: string;
  className?: string;
}

export function ProgressBar({ value = null, label, className = "" }: ProgressBarProps) {
  const indeterminate = value === null;

  return (
    <div className={className}>
      {label && (
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <p className="text-xs text-mut">{label}</p>
          {!indeterminate && (
            <p className="font-mono text-xs tabular-nums text-mut">
              {Math.round(value)}%
            </p>
          )}
        </div>
      )}
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-valuenow={indeterminate ? undefined : Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={
            indeterminate
              ? "h-full w-1/3 animate-[indeterminate-slide_1.2s_ease-in-out_infinite] rounded-full bg-accent"
              : "h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
          }
          style={indeterminate ? undefined : { width: `${value}%` }}
        />
      </div>
    </div>
  );
}