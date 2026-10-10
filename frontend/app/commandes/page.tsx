"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { api, messageFromError } from "@/lib/api";
import type { Transaction } from "@/lib/types";
import NotificationBell from "@/components/NotificationBell";
import NombreAnime from "@/components/NombreAnime";
import AchatReussi from "@/components/AchatReussi";
import Toast, { type ToastData } from "@/components/Toast";

const DUREE_SORTIE = 450;

type Issue = "confirmee" | "refusee";

type VenteConfirmee = {
  acheteur: string;
  kwh: string;
  total: string;
};

export default function CommandesPage() {
  const { user, token, loading, refreshUser } = useAuth();
  const router = useRouter();

  const [commandes, setCommandes] = useState<Transaction[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [sortie, setSortie] = useState<Record<number, Issue>>({});
  const [aRefuser, setARefuser] = useState<Transaction | null>(null);
  const [motif, setMotif] = useState("");
  const [vente, setVente] = useState<VenteConfirmee | null>(null);
  const [toast, setToast] = useState<ToastData>(null);

  // On ne dépend que de valeurs simples : un refreshUser() ne doit pas
  // relancer les vérifications et le rechargement de la liste.
  const connecte = Boolean(user);
  const role = user?.role;

  const fermerVente = useCallback(() => setVente(null), []);
  const fermerToast = useCallback(() => setToast(null), []);

  const charger = useCallback(
    async (silencieux = false) => {
      if (!token) {
        setFetching(false);
        return;
      }

      try {
        const resultat = await api<Transaction[]>("/commandes-en-attente", {
          token,
        });
        setError("");
        setCommandes(resultat);
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

  // Échap ferme la fenêtre de refus
  useEffect(() => {
    if (!aRefuser) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && busyId === null) setARefuser(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aRefuser, busyId]);

  // Joue l'animation de sortie de la carte, puis la retire de la liste.
  async function sortir(id: number, issue: Issue) {
    setSortie((prev) => ({ ...prev, [id]: issue }));
    await new Promise((resolve) => setTimeout(resolve, DUREE_SORTIE));
    setCommandes((prev) => prev.filter((c) => c.id !== id));
    setSortie((prev) => {
      const suite = { ...prev };
      delete suite[id];
      return suite;
    });
  }

  async function confirmer(t: Transaction) {
    setBusyId(t.id);
    setError("");

    try {
      await api(`/transactions/${t.id}/confirmer`, { method: "POST", token });
    } catch (err) {
      setError(messageFromError(err));
      setBusyId(null);
      return;
    }

    // La vente est confirmée : on célèbre, puis on met à jour les chiffres.
    setVente({
      acheteur: t.consommateur?.name || "Acheteur",
      kwh: `${t.quantite_kwh} kWh`,
      total: `${t.prix_total} crédits`,
    });
    await sortir(t.id, "confirmee");
    setBusyId(null);

    try {
      await Promise.all([charger(true), refreshUser()]);
    } catch {
      /* non bloquant */
    }
  }

  async function confirmerRefus() {
    const t = aRefuser;
    if (!t) return;

    const texte = motif.trim();
    setBusyId(t.id);
    setError("");

    try {
      await api(`/transactions/${t.id}/refuser`, {
        method: "POST",
        token,
        body: texte ? { motif: texte } : {},
      });
    } catch (err) {
      setError(messageFromError(err));
      setBusyId(null);
      setARefuser(null);
      return;
    }

    setARefuser(null);
    setMotif("");
    await sortir(t.id, "refusee");
    setBusyId(null);
    setToast({ id: Date.now(), type: "info", texte: "Commande refusée." });

    await charger(true);
  }

  function ouvrirRefus(t: Transaction) {
    setMotif("");
    setARefuser(t);
  }

  if (loading || !user) {
    return (
      <main className="transactions-loading">
        <span className="transactions-spinner" aria-hidden="true" />
        <p>Chargement de votre espace…</p>
      </main>
    );
  }

  return (
    <main className="transactions-page">
      <header className="transactions-topbar">
        <Link
          href="/dashboard"
          className="transactions-brand"
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

        <nav className="transactions-nav" aria-label="Navigation principale">
          <Link href="/dashboard">Tableau de bord</Link>
          <Link href="/mes-offres">Mes offres</Link>
          <Link href="/installation">Mon installation</Link>
          <Link href="/transactions">Mes ventes</Link>
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

      <section className="transactions-content">
        <div className="transactions-heading">
          <div>
            <span className="transactions-eyebrow">ESPACE PRODUCTEUR</span>
            <h1>Commandes en attente</h1>
            <p>Confirmez ou refusez les commandes passées sur vos offres.</p>
          </div>

          <div className="transactions-count">
            <span>
              <NombreAnime valeur={commandes.length} depuis={0} duree={700} />
            </span>
            <small>
              {commandes.length === 1 ? "commande" : "commandes"}
            </small>
          </div>
        </div>

        {error && (
          <div className="transactions-error" role="alert">
            <span aria-hidden="true">!</span>
            {error}
          </div>
        )}

        {fetching ? (
          <div className="transactions-state">
            <span className="transactions-spinner" aria-hidden="true" />
            <p>Récupération de vos commandes…</p>
          </div>
        ) : commandes.length === 0 ? (
          <div className="transactions-empty">
            <div className="transactions-empty-icon" aria-hidden="true">
              ✓
            </div>
            <h2>Tout est à jour</h2>
            <p>
              Aucune commande en attente. Les nouvelles commandes apparaîtront
              ici dès qu’un consommateur achètera l’une de vos offres.
            </p>
            <Link href="/transactions" className="transactions-action">
              Voir mes ventes <span aria-hidden="true">→</span>
            </Link>
          </div>
        ) : (
          <div className="commandes-grid">
            {commandes.map((c) => {
              const nom = c.consommateur?.name || "Acheteur";
              const enCours = busyId === c.id;

              return (
                <article
                  key={c.id}
                  className={`commande-card${
                    sortie[c.id] ? ` is-sortie-${sortie[c.id]}` : ""
                  }`}
                >
                  <div className="offre-card-top">
                    <div className="offre-avatar" aria-hidden="true">
                      {nom.charAt(0).toUpperCase()}
                    </div>
                    <div className="offre-producer">
                      <span className="offre-producer-label">ACHETEUR</span>
                      <h3>{nom}</h3>
                    </div>
                    <span className="transactions-status transactions-status-en-attente">
                      En attente
                    </span>
                  </div>

                  <div className="mes-offres-details">
                    <div>
                      <span>Énergie commandée</span>
                      <strong>{c.quantite_kwh} kWh</strong>
                    </div>
                    <div>
                      <span>Total</span>
                      <strong>{c.prix_total} crédits</strong>
                    </div>
                  </div>

                  <p className="commande-meta">
                    Offre #{c.offre_id}
                    {c.created_at &&
                      ` · ${new Date(c.created_at).toLocaleString("fr-FR", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}`}
                  </p>

                  <div className="commande-actions">
                    <button
                      type="button"
                      className={`commande-confirmer${enCours ? " is-loading" : ""}`}
                      aria-busy={enCours}
                      disabled={enCours}
                      onClick={() => confirmer(c)}
                    >
                      {enCours ? "Confirmation…" : "Confirmer"}
                    </button>
                    <button
                      type="button"
                      className="commande-refuser"
                      disabled={enCours}
                      onClick={() => ouvrirRefus(c)}
                    >
                      Refuser
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {aRefuser && (
        <div
          className="confirm-overlay"
          onClick={() => busyId === null && setARefuser(null)}
        >
          <div
            className="confirm-carte"
            role="dialog"
            aria-modal="true"
            aria-labelledby="refus-titre"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="confirm-icone confirm-icone-danger" aria-hidden="true">
              ✕
            </div>
            <h2 id="refus-titre">Refuser cette commande ?</h2>
            <p>
              {aRefuser.quantite_kwh} kWh · {aRefuser.prix_total} crédits ·{" "}
              {aRefuser.consommateur?.name || "Acheteur"}
            </p>

            <label className="confirm-champ">
              <span>Motif du refus (facultatif)</span>
              <textarea
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                maxLength={255}
                rows={3}
                placeholder="Ex. énergie plus disponible"
                autoFocus
              />
            </label>

            <div className="confirm-actions">
              <button
                type="button"
                className="confirm-non"
                disabled={busyId !== null}
                onClick={() => setARefuser(null)}
              >
                Retour
              </button>
              <button
                type="button"
                className="confirm-oui"
                disabled={busyId !== null}
                onClick={confirmerRefus}
              >
                {busyId !== null ? "Refus en cours…" : "Refuser"}
              </button>
            </div>
          </div>
        </div>
      )}

      <AchatReussi
        open={vente !== null}
        onClose={fermerVente}
        titre="Vente confirmée !"
        message="La transaction est confirmée et apparaît dans vos ventes."
        details={
          vente
            ? [
                { label: "Acheteur", valeur: vente.acheteur },
                { label: "Énergie", valeur: vente.kwh },
                { label: "Total", valeur: vente.total },
              ]
            : []
        }
      />

      <Toast toast={toast} onClose={fermerToast} />
    </main>
  );
}