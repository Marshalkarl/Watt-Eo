"use client";

import { useEffect } from "react";

export type ToastData = {
  id: number;
  type: "succes" | "info" | "erreur";
  texte: string;
} | null;

const ICONES = { succes: "✓", info: "↺", erreur: "!" } as const;

export default function Toast({
  toast,
  onClose,
  duree = 3500,
}: {
  toast: ToastData;
  onClose: () => void;
  duree?: number;
}) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onClose, duree);
    return () => clearTimeout(t);
  }, [toast, onClose, duree]);

  if (!toast) return null;

  return (
    <div
      key={toast.id}
      className={`toast toast-${toast.type}`}
      role="status"
      aria-live="polite"
      onClick={onClose}
    >
      <span className="toast-icone" aria-hidden="true">
        {ICONES[toast.type]}
      </span>
      <span>{toast.texte}</span>
      <span className="toast-barre" style={{ animationDuration: `${duree}ms` }} />
    </div>
  );
}