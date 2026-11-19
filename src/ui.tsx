// Small shared controls. Real buttons, labels and inputs, sized for touch (44 px on coarse pointers).

import { useId } from 'react';
import type { ReactNode } from 'react';

export const card = 'rounded-card border border-line bg-panel';

export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`text-xs font-semibold tracking-[0.08em] text-muted uppercase ${className}`}>{children}</span>;
}

interface SegmentedProps<T extends string> {
  label: string;
  options: readonly (readonly [T, string])[];
  /** null when none of the options matches, such as a number set by hand. */
  value: T | null;
  onChange(value: T): void;
  className?: string;
  /** Wraps into rows this many buttons wide, for long words in a narrow column. */
  columns?: number;
}

/** A row of mutually exclusive buttons. */
export function Segmented<T extends string>({ label, options, value, onChange, className = '', columns }: SegmentedProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gridAutoFlow: 'row' } : undefined}
      className={`grid auto-cols-fr grid-flow-col gap-1 rounded-xl border border-line p-1 ${className}`}
    >
      {options.map(([id, text]) => (
        <button
          key={id}
          type="button"
          aria-pressed={id === value}
          onClick={() => onChange(id)}
          className={`min-h-11 rounded-[9px] px-3 font-semibold ${id === value ? 'bg-sel text-on-sel' : 'text-soft hover:bg-raised'}`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

interface SliderProps {
  label: string;
  /** The value in words, shown beside the label. */
  display: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange(value: number): void;
}

export function Slider({ label, display, value, min, max, step, onChange }: SliderProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between gap-3 text-sm">
        <label htmlFor={id} className="text-muted">
          {label}
        </label>
        <span className="font-semibold">{display}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="m-0 h-7 w-full pointer-coarse:h-11"
      />
    </div>
  );
}

/** The ball mark from the design. */
export function Logo({ className = 'size-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <circle cx="16" cy="16" r="14" className="fill-ball" />
      <path d="M10 3.5 C15 11 15 21 10 28.5" fill="none" className="stroke-stumps" strokeWidth="1.6" strokeDasharray="2 2" />
      <path d="M14 2.3 C19 11 19 21 14 29.7" fill="none" className="stroke-stumps" strokeWidth="1.6" strokeDasharray="2 2" />
    </svg>
  );
}
