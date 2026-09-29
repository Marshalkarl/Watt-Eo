"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { api, messageFromError } from "@/lib/api";
import type { Offre } from "@/lib/types";

export default function MesOffresPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();

  const [offres, setOffres] = useState<Offre[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [actionEnCours, setActionEnCours] = useState<number | null>(null);

  const charger = useCallback(async () => {
    if (!token) {
      setFetching(false);
      return;
    }

    try {
      setError("");
      const resultat = await api<Offre[]>("/mes-offres", { token });
      setOffres(resultat);
    } catch (err) {
      setError(messageFromError(err));
    } finally {
      setFetching(false);
    }
  }, [token]);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (user.role !== "producteur") {
      router.replace("/dashboard");
      return;
    }

    void charger();
  }, [loading, user, router, charger]);

  async function basculer(offre: Offre) {
    if (!token) return;

    setError("");
    setActionEnCours(offre.id);

    try {
      await api(`/offres/${offre.id}`, {
        method: "PUT",
        token,
        body: { disponible: !offre.disponible },
      });
      await charger();
    } catch (err) {
      setError(messageFromError(err));
    } finally {
      setActionEnCours(null);
    }
  }

  async function supprimer(offre: Offre) {
    if (
      !token ||
      !window.confirm("Supprimer définitivement cette offre ?")
    ) {
      return;
    }

    setError("");
    setActionEnCours(offre.id);

    try {
      await api(`/offres/${offre.id}`, { method: "DELETE", token });
      await charger();
    } catch (err) {
      setError(messageFromError(err));
    } finally {
      setActionEnCours(null);
    }
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
    (offre) => offre.disponible && offre.quantite_kwh > 0,
  ).length;

  return (
    <main className="mes-offres-page">
      <header className="mes-offres-topbar">
        <Link
          href="/dashboard"
          className="mes-offres-brand"
          aria-label="AfriWatt, tableau de bord"
        >
          <Image
            src="/images/afriwatt-logo.png"
            alt="AfriWatt"
            width={160}
            height={48}
            priority
            className="home-brand-logo"
          />
        </Link>

        <nav className="mes-offres-nav" aria-label="Navigation principale">
          <Link href="/dashboard">Tableau de bord</Link>
          <Link href="/transactions">Mes ventes</Link>
          <Link href="/offres">Explorer les offres</Link>
        </nav>
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
              <strong>{offres.length}</strong>
            </div>
          </article>

          <article className="mes-offres-summary-card">
            <span className="mes-offres-summary-icon" aria-hidden="true">
              🟢
            </span>
            <div>
              <span className="mes-offres-summary-label">Offres visibles</span>
              <strong>{offresDisponibles}</strong>
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
                const epuisee = offre.quantite_kwh <= 0;
                const visible = offre.disponible && !epuisee;
                const enCours = actionEnCours === offre.id;

                return (
                  <article className="mes-offres-card" key={offre.id}>
                    <div className="mes-offres-card-top">
                      <span className="mes-offres-card-icon" aria-hidden="true">
                        ☀️
                      </span>
                      <span
                        className={`mes-offres-status ${
                          visible
                            ? "is-visible"
                            : epuisee
                              ? "is-empty"
                              : "is-hidden"
                        }`}
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

                    <div className="mes-offres-location">
                      <span aria-hidden="true">⌖</span>
                      <span>
                        {offre.latitude}, {offre.longitude}
                      </span>
                    </div>

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
                        onClick={() => void supprimer(offre)}
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
    </main>
  );
}