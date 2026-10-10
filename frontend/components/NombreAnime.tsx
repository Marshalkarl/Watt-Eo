"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  valeur: number;
  decimales?: number;
  duree?: number;
  /** Valeur de départ au premier affichage (ex. 0 pour compter depuis zéro). */
  depuis?: number;
  /** true : toujours `decimales` chiffres après la virgule. false : seulement si utile. */
  fixe?: boolean;
};

export default function NombreAnime({
  valeur,
  decimales = 0,
  duree = 900,
  depuis,
  fixe = true,
}: Props) {
  const [affiche, setAffiche] = useState(depuis ?? valeur);
  const courant = useRef(depuis ?? valeur);

  useEffect(() => {
    const from = courant.current;
    if (from === valeur) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      courant.current = valeur;
      setAffiche(valeur);
      return;
    }

    const debut = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const p = Math.min((now - debut) / duree, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = from + (valeur - from) * eased;
      courant.current = v;
      setAffiche(v);
      if (p < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [valeur, duree]);

  return (
    <span className="nombre-anime">
      {affiche.toLocaleString("fr-FR", {
        minimumFractionDigits: fixe ? decimales : 0,
        maximumFractionDigits: decimales,
      })}
    </span>
  );
}