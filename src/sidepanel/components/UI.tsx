import type { ButtonHTMLAttributes, PropsWithChildren, ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, LoaderCircle, XCircle } from "lucide-react";

export function Button({
  variant = "secondary",
  loading,
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
}) {
  return (
    <button
      {...props}
      className={`button button-${variant}${className ? ` ${className}` : ""}`}
      disabled={loading || props.disabled}
    >
      {loading ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export function Card({
  children,
  className = ""
}: PropsWithChildren<{ className?: string }>) {
  return <section className={`card ${className}`}>{children}</section>;
}

export function EmptyState({
  title,
  body,
  action
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <Info size={20} aria-hidden="true" />
      <strong>{title}</strong>
      <p>{body}</p>
      {action}
    </div>
  );
}

export function Notice({
  tone = "info",
  children
}: PropsWithChildren<{ tone?: "info" | "success" | "warning" | "danger" }>) {
  const Icon =
    tone === "success"
      ? CheckCircle2
      : tone === "danger"
        ? XCircle
        : tone === "warning"
          ? AlertCircle
          : Info;
  return (
    <div className={`notice notice-${tone}`} role={tone === "danger" ? "alert" : "status"}>
      <Icon size={17} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

export function LoadingPanel({
  label,
  detail,
  onCancel
}: {
  label: string;
  detail?: string;
  onCancel?: () => void;
}) {
  return (
    <div className="loading-panel" role="status" aria-live="polite" aria-busy="true">
      <LoaderCircle size={22} className="spin" aria-hidden="true" />
      <div className="loading-panel-copy">
        <strong>{label}</strong>
        {detail ? <p>{detail}</p> : null}
        {onCancel ? (
          <button type="button" className="button button-secondary loading-panel-cancel" onClick={onCancel}>
            Stop request
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral"
}: PropsWithChildren<{ tone?: "neutral" | "good" | "warn" | "bad" | "blue" }>) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Field({
  label,
  hint,
  children
}: PropsWithChildren<{ label: string; hint?: string }>) {
  return (
    <label className="form-field">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}
