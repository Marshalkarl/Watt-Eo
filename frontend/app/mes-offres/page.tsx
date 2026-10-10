"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { api, messageFromError } from "@/lib/api";
import type { Offre } from "@/lib/types";
import NotificationBell from "@/components/NotificationBell";
import NombreAnime from "@/components/NombreAnime";
import Toast, { type ToastData } from "@/components/Toast";

const DUREE_SORTIE = 450;

export default function MesOffresPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();

  const [offres, setOffres] = useState<Offre[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [actionEnCours, setActionEnCours] = useState<number | null>(null);
  const [aSupprimer, setASupprimer] = useState<Offre | null>(null);
  const [sortantId, setSortantId] = useState<number | null>(null);
  const [toast, setToast] = useState<ToastData>(null);

  // Valeurs simples pour ne pas relancer le chargement à chaque changement de `user`.
  const connecte = Boolean(user);
  const role = user?.role;

  const fermerToast = useCallback(() => setToast(null), []);
  const notifier = useCallback(
    (type: "succes" | "info" | "erreur", texte: string) =>
      setToast({ id: Date.now(), type, texte }),
    [],
  );

  const charger = useCallback(
    async (silencieux = false) => {
      if (!token) {
        setFetching(false);
        return;
      }

      try {
        const resultat = await api<Offre[]>("/mes-offres", { token });
        setError("");
        setOffres(resultat);
      } catch (err) {
        // Après une action réussie, un échec de rafraîchissement n'est pas bloquant.
        if (!silencieux) setError(messageFromError(err));
      } finally {
        setFetching(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (loading) return;

    if (!connecte) {
      router.replace("/login");
      return;
    }

    if (role !== "producteur") {
      router.replace("/dashboard");
      return;
    }

    void charger();
  }, [loading, connecte, role, router, charger]);

  // Échap ferme la fenêtre de suppression
  useEffect(() => {
    if (!aSupprimer) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && actionEnCours === null) setASupprimer(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aSupprimer, actionEnCours]);

  async function basculer(offre: Offre) {
    if (!token) return;

    const visibleApres = !offre.disponible;

    setError("");
    setActionEnCours(offre.id);

    try {
      await api(`/offres/${offre.id}`, {
        method: "PUT",
        token,
        body: { disponible: visibleApres },
      });
    } catch (err) {
      setError(messageFromError(err));
      setActionEnCours(null);
      return;
    }

    // Mise à jour immédiate de la carte, puis synchronisation discrète.
    setOffres((prev) =>
      prev.map((o) =>
        o.id === offre.id ? { ...o, disponible: visibleApres } : o,
      ),
    );
    setActionEnCours(null);
    notifier(
      visibleApres ? "succes" : "info",
      visibleApres ? "Offre de nouveau visible." : "Offre masquée.",
    );
    await charger(true);
  }

  async function confirmerSuppression() {
    const offre = aSupprimer;
    if (!offre || !token) return;

    setError("");
    setActionEnCours(offre.id);

    try {
      await api(`/offres/${offre.id}`, { method: "DELETE", token });
    } catch (err) {
      setError(messageFromError(err));
      setActionEnCours(null);
      setASupprimer(null);
      return;
    }

    setASupprimer(null);
    setSortantId(offre.id);
    await new Promise((resolve) => setTimeout(resolve, DUREE_SORTIE));
    setOffres((prev) => prev.filter((o) => o.id !== offre.id));
    setSortantId(null);
    setActionEnCours(null);
    notifier("info", "Offre supprimée.");
    await charger(true);
  }

  if (loading || !user) {
    return (
      <main className="mes-offres-loading">
        <span className="mes-offres-spinner" aria-hidden="true" />
        <p>Préparation de votre espace…</p>
      </main>
    );
  }

  const offresDisponibles = offres.filter(
    (offre) => offre.disponible && Number(offre.quantite_kwh) > 0,
  ).length;

  return (
    <main className="mes-offres-page">
      <header className="mes-offres-topbar">
        <Link
          href="/dashboard"
          className="mes-offres-brand"
          aria-label="Watt-Eo, tableau de bord"
        >
          <Image
            src="/images/Watt-Eo-logo.png"
            alt="Watt-Eo"
            width={160}
            height={48}
            priority
            className="home-brand-logo"
          />
        </Link>

        <nav className="mes-offres-nav" aria-label="Navigation principale">
          <Link href="/dashboard">Tableau de bord</Link>
          <Link href="/installation">Mon installation</Link>
          <Link href="/transactions">Mes ventes</Link>
          <Link href="/offres">Explorer les offres</Link>
        </nav>

        <div className="dashboard-actions">
          <NotificationBell />
          <Link
            href="/profil"
            className="notif-bell profil-link"
            aria-label="Mon profil"
            title="Mon profil"
          >
            <span aria-hidden="true">👤</span>
          </Link>
        </div>
      </header>

      <div className="mes-offres-content">
        <section className="mes-offres-hero">
          <div>
            <span className="mes-offres-kicker">ESPACE PRODUCTEUR</span>
            <h1>Mes offres d’énergie</h1>
            <p>
              Gérez vos annonces et suivez l’énergie renouvelable que vous
              partagez.
            </p>
          </div>

          <Link href="/offres/nouvelle" className="mes-offres-create">
            <span aria-hidden="true">＋</span>
            Publier une offre
          </Link>
        </section>

        <section className="mes-offres-summary" aria-label="Résumé des offres">
          <article className="mes-offres-summary-card">
            <span className="mes-offres-summary-icon" aria-hidden="true">
              ☀️
            </span>
            <div>
              <span className="mes-offres-summary-label">Offres publiées</span>
              <strong>
                <NombreAnime valeur={offres.length} depuis={0} duree={700} />
              </strong>
            </div>
          </article>

          <article className="mes-offres-summary-card">
            <span className="mes-offres-summary-icon" aria-hidden="true">
              🟢
            </span>
            <div>
              <span className="mes-offres-summary-label">Offres visibles</span>
              <strong>
                <NombreAnime
                  valeur={offresDisponibles}
                  depuis={0}
                  duree={700}
                />
              </strong>
            </div>
          </article>
        </section>

        {error && (
          <p className="mes-offres-alert" role="alert">
            <span aria-hidden="true">!</span>
            {error}
          </p>
        )}

        {fetching ? (
          <div className="mes-offres-state">
            <span className="mes-offres-spinner" aria-hidden="true" />
            <p>Chargement de vos offres…</p>
          </div>
        ) : offres.length === 0 ? (
          <section className="mes-offres-empty">
            <span className="mes-offres-empty-icon" aria-hidden="true">
              ⚡
            </span>
            <h2>Votre première offre vous attend</h2>
            <p>
              Publiez votre surplus d’énergie pour le rendre accessible aux
              consommateurs autour de vous.
            </p>
            <Link href="/offres/nouvelle" className="mes-offres-create">
              Publier ma première offre
            </Link>
          </section>
        ) : (
          <section className="mes-offres-list-section">
            <div className="mes-offres-list-heading">
              <div>
                <span className="mes-offres-kicker">VOTRE ÉNERGIE</span>
                <h2>Offres publiées</h2>
              </div>
              <span className="mes-offres-count">
                {offres.length} {offres.length === 1 ? "offre" : "offres"}
              </span>
            </div>

            <div className="mes-offres-grid">
              {offres.map((offre) => {
                const epuisee = Number(offre.quantite_kwh) <= 0;
                const visible = Boolean(offre.disponible) && !epuisee;
                const enCours = actionEnCours === offre.id;
                const etat = visible ? "visible" : epuisee ? "empty" : "hidden";
                const latitude = Number(offre.latitude);
                const longitude = Number(offre.longitude);
                const aUnePosition =
                  offre.latitude != null &&
                  offre.longitude != null &&
                  Number.isFinite(latitude) &&
                  Number.isFinite(longitude);

                return (
                  <article
                    className={`mes-offres-card${
                      visible ? "" : " is-attenuee"
                    }${sortantId === offre.id ? " is-sortante" : ""}`}
                    key={offre.id}
                  >
                    <div className="mes-offres-card-top">
                      <span className="mes-offres-card-icon" aria-hidden="true">
                        ☀️
                      </span>
                      {/* key = état : l'animation rejoue quand le statut change */}
                      <span
                        key={etat}
                        className={`mes-offres-status is-${etat}`}
                      >
                        <span className="mes-offres-status-dot" />
                        {visible ? "Visible" : epuisee ? "Épuisée" : "Masquée"}
                      </span>
                    </div>

                    <h3>Offre #{offre.id}</h3>
                    <p className="mes-offres-card-description">
                      Votre énergie solaire proposée à la communauté.
                    </p>

                    <div className="mes-offres-details">
                      <div>
                        <span>Énergie disponible</span>
                        <strong>{offre.quantite_kwh} kWh</strong>
                      </div>
                      <div>
                        <span>Prix par kWh</span>
                        <strong>{offre.prix_kwh} crédits</strong>
                      </div>
                    </div>

                    {aUnePosition && (
                      <div className="mes-offres-location">
                        <span aria-hidden="true">⌖</span>
                        <span>
                          {latitude.toFixed(4)}, {longitude.toFixed(4)}
                        </span>
                      </div>
                    )}

                    <div className="mes-offres-actions">
                      <button
                        type="button"
                        className="mes-offres-toggle"
                        onClick={() => void basculer(offre)}
                        disabled={enCours || epuisee}
                      >
                        {enCours
                          ? "Mise à jour…"
                          : offre.disponible
                            ? "Masquer l’offre"
                            : "Réafficher"}
                      </button>

                      <button
                        type="button"
                        className="mes-offres-delete"
                        onClick={() => setASupprimer(offre)}
                        disabled={enCours}
                        aria-label={`Supprimer l’offre ${offre.id}`}
                        title="Supprimer l’offre"
                      >
                        Supprimer
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {aSupprimer && (
        <div
          className="confirm-overlay"
          onClick={() => actionEnCours === null && setASupprimer(null)}
        >
          <div
            className="confirm-carte"
            role="dialog"
            aria-modal="true"
            aria-labelledby="suppr-titre"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="confirm-icone confirm-icone-danger" aria-hidden="true">
              🗑
            </div>
            <h2 id="suppr-titre">Supprimer cette offre ?</h2>
            <p>
              Offre #{aSupprimer.id} · {aSupprimer.quantite_kwh} kWh à{" "}
              {aSupprimer.prix_kwh} crédits. Cette action est définitive.
            </p>

            <div className="confirm-actions">
              <button
                type="button"
                className="confirm-non"
                disabled={actionEnCours !== null}
                onClick={() => setASupprimer(null)}
              >
                Garder
              </button>
              <button
                type="button"
                className="confirm-oui"
                disabled={actionEnCours !== null}
                onClick={() => void confirmerSuppression()}
              >
                {actionEnCours !== null ? "Suppression…" : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} onClose={fermerToast} />
    </main>
  );
}