"use client";

import { useEffect } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  titre?: string;
  message?: string;
  details?: { label: string; valeur: string }[];
  dureeMs?: number;
};

const COULEURS = ["#4caf6a", "#f5b83d", "#5aa9d6", "#2e7a46", "#bfe0c5", "#8a6a4a"];

export default function AchatReussi({
  open,
  onClose,
  titre = "Achat réussi !",
  message = "Votre commande a bien été enregistrée.",
  details = [],
  dureeMs = 4000,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onClose, dureeMs);
    return () => clearTimeout(t);
  }, [open, onClose, dureeMs]);

  if (!open) return null;

  return (
    <div className="achat-overlay" onClick={onClose} role="dialog" aria-live="polite">
      <div className="achat-confettis" aria-hidden="true">
        {Array.from({ length: 36 }).map((_, i) => (
          <span
            key={i}
            style={{
              left: `${(i * 97) % 100}%`,
              background: COULEURS[i % COULEURS.length],
              animationDelay: `${(i % 9) * 0.07}s`,
              animationDuration: `${1.8 + (i % 5) * 0.25}s`,
              width: `${6 + (i % 3) * 3}px`,
              height: `${10 + (i % 4) * 3}px`,
            }}
          />
        ))}
      </div>

      <div className="achat-carte" onClick={(e) => e.stopPropagation()}>
        <svg className="achat-check" viewBox="0 0 52 52" aria-hidden="true">
          <circle className="achat-check-cercle" cx="26" cy="26" r="24" fill="none" />
          <path className="achat-check-trait" fill="none" d="M14 27l8 8 16-17" />
        </svg>

        <h2>{titre}</h2>
        <p>{message}</p>

        {details.length > 0 && (
          <dl className="achat-details">
            {details.map((d) => (
              <div key={d.label}>
                <dt>{d.label}</dt>
                <dd>{d.valeur}</dd>
              </div>
            ))}
          </dl>
        )}

        <button type="button" className="achat-fermer" onClick={onClose}>
          Super !
        </button>
        <div className="achat-progress" style={{ animationDuration: `${dureeMs}ms` }} />
      </div>
    </div>
  );
}