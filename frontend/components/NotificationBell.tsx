"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import type { NotificationItem, NotificationsReponse } from "@/lib/types";

const INTERVALLE_MS = 30_000;

const formaterDate = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

// Une nouvelle commande mène le producteur à ses commandes, le reste à l'historique
const lienDe = (n: NotificationItem) =>
  n.type === "commande_recue" ? "/commandes" : "/transactions";

export default function NotificationBell() {
  const { user, token } = useAuth();
  const [ouvert, setOuvert] = useState(false);
  const [donnees, setDonnees] = useState<NotificationsReponse>({
    non_lues: 0,
    notifications: [],
  });
  const racine = useRef<HTMLDivElement>(null);

  const actif = Boolean(token) && user?.role !== "admin";

  const charger = useCallback(async () => {
    if (!actif) return;
    try {
      setDonnees(await api<NotificationsReponse>("/notifications", { token }));
    } catch {
      // Silencieux : la cloche ne doit jamais perturber la page
    }
  }, [actif, token]);

  // Chargement initial + rafraîchissement régulier (onglet visible uniquement)
  useEffect(() => {
    if (!actif) return;
    void charger();
    const id = window.setInterval(() => {
      if (!document.hidden) void charger();
    }, INTERVALLE_MS);
    return () => window.clearInterval(id);
  }, [actif, charger]);

  // Fermeture au clic extérieur et à la touche Échap
  useEffect(() => {
    if (!ouvert) return;

    const fermerAuClic = (e: MouseEvent) => {
      if (racine.current && !racine.current.contains(e.target as Node)) {
        setOuvert(false);
      }
    };
    const fermerAEchap = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOuvert(false);
    };

    document.addEventListener("mousedown", fermerAuClic);
    document.addEventListener("keydown", fermerAEchap);
    return () => {
      document.removeEventListener("mousedown", fermerAuClic);
      document.removeEventListener("keydown", fermerAEchap);
    };
  }, [ouvert]);

  async function marquerLue(n: NotificationItem) {
    setOuvert(false);
    if (n.lue) return;

    // Mise à jour immédiate de l'affichage, puis appel API
    setDonnees((d) => ({
      non_lues: Math.max(0, d.non_lues - 1),
      notifications: d.notifications.map((x) =>
        x.id === n.id ? { ...x, lue: true } : x,
      ),
    }));

    try {
      await api(`/notifications/${n.id}/lue`, { method: "POST", token });
    } catch {
      void charger(); // en cas d'échec, on réaffiche l'état réel
    }
  }

  async function toutLire() {
    setDonnees((d) => ({
      non_lues: 0,
      notifications: d.notifications.map((x) => ({ ...x, lue: true })),
    }));

    try {
      await api("/notifications/tout-lire", { method: "POST", token });
    } catch {
      void charger();
    }
  }

  if (!actif) return null;

  return (
    <div className="notif" ref={racine}>
      <button
        type="button"
        className="notif-bell"
        onClick={() => setOuvert((o) => !o)}
        aria-label={
          donnees.non_lues > 0
            ? `Notifications, ${donnees.non_lues} non lue(s)`
            : "Notifications"
        }
        aria-expanded={ouvert}
        aria-haspopup="true"
      >
        <span aria-hidden="true">🔔</span>
        {donnees.non_lues > 0 && (
          <span className="notif-badge" aria-hidden="true">
            {donnees.non_lues > 9 ? "9+" : donnees.non_lues}
          </span>
        )}
      </button>

      {ouvert && (
        <div className="notif-panel" role="region" aria-label="Notifications">
          <div className="notif-panel-head">
            <strong>Notifications</strong>
            {donnees.non_lues > 0 && (
              <button type="button" onClick={toutLire}>
                Tout marquer comme lu
              </button>
            )}
          </div>

          {donnees.notifications.length === 0 ? (
            <p className="notif-empty">Aucune notification pour le moment.</p>
          ) : (
            <ul className="notif-list">
              {donnees.notifications.map((n) => (
                <li key={n.id}>
                  <Link
                    href={lienDe(n)}
                    className={`notif-item${n.lue ? "" : " is-unread"}`}
                    onClick={() => void marquerLue(n)}
                  >
                    <span className="notif-item-title">{n.titre}</span>
                    <span className="notif-item-text">{n.message}</span>
                    <span className="notif-item-date">
                      {formaterDate(n.date)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}