// ----------------------------------------------------------------------------
//  Sdílená UI primitiva. Vzhled je JEDNOTNÝ s třídami .btn/.card/.field/.badge
//  z globals.css, aby všechny tři moduly vypadaly stejně (jedna aplikace).
// ----------------------------------------------------------------------------
import * as React from "react";
import { cn } from "@/lib/cn";

// ---------- Badge ----------
export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("badge", className)} {...props} />;
}

// ---------- Button ----------
// Varianty i velikosti odpovídají třídám .btn-* (stejné jako Zakázky/Konstrukce).
const BUTTON_VARIANTS: Record<string, string> = {
  default: "bg-user-0 font-semibold text-on-accent hover:opacity-90",
  destructive: "bg-destructive font-semibold text-on-accent hover:opacity-90",
  outline: "border border-input bg-transparent text-text hover:bg-accent",
  secondary: "border border-input bg-transparent text-text hover:bg-accent",
  ghost: "text-text hover:bg-accent",
  link: "text-link underline-offset-4 hover:underline",
};

const BUTTON_SIZES: Record<string, string> = {
  default: "h-9 px-3 py-1.5",
  sm: "h-8 px-2.5 text-xs",
  lg: "h-10 px-6",
  icon: "h-8 w-8",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof BUTTON_VARIANTS;
  size?: keyof typeof BUTTON_SIZES;
}

export function Button({ className, variant = "default", size = "default", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...props}
    />
  );
}

// ---------- Card (bez stínu, ať sedí s .card) ----------
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border border-line bg-surface", className)} {...props} />;
}
export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-1.5 p-4", className)} {...props} />;
}
export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  // Jednotný styl sekčního nadpisu (jako <h2> v Zakázkách/Konstrukci).
  return (
    <div className={cn("text-sm font-semibold uppercase tracking-wide text-text-muted", className)} {...props} />
  );
}
export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4 pt-0", className)} {...props} />;
}

// ---------- Pole (Input / Label / Textarea / Select) → styl .field/.label ----------
export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("field", className)} {...props} />;
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("label", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn("field", className)} {...props} />;
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn("field", className)} {...props} />;
}

// ---------- Table ----------
export function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="relative w-full overflow-x-auto">
      <table className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  );
}
export function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("[&_tr]:border-b [&_tr]:border-line", className)} {...props} />;
}
export function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}
export function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("border-b border-line transition-colors hover:bg-accent/50", className)} {...props} />;
}
export function TableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn("h-10 px-3 text-left align-middle font-medium text-text-muted", className)}
      {...props}
    />
  );
}
export function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-3 py-2.5 align-middle", className)} {...props} />;
}
