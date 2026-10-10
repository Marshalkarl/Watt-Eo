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
import Toast, { type ToastData } from "@/components/Toast";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api";

const LIBELLES: Record<string, string> = {
  en_attente: "En attente",
  confirmee: "Confirmée",
  annulee: "Annulée",
  refusee: "Refusée",
  echouee: "Échouée",
};

const libelleStatut = (statut: unknown) => {
  const brut = String(statut);
  return (
    LIBELLES[brut] ??
    brut.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())
  );
};

const classeStatut = (statut: unknown) =>
  String(statut)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");

export default function TransactionsPage() {
  const { user, token, loading, refreshUser } = useAuth();
  const router = useRouter();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [error, setError] = useState("");
  const [fetching, setFetching] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [exportEnCours, setExportEnCours] = useState(false);
  const [aAnnuler, setAAnnuler] = useState<Transaction | null>(null);
  const [flashId, setFlashId] = useState<number | null>(null);
  const [toast, setToast] = useState<ToastData>(null);

  // On ne dépend que de ces valeurs simples : un refreshUser() ne doit pas
  // relancer le chargement de la liste (et réafficher le spinner).
  const connecte = Boolean(user);
  const role = user?.role;

  const notifier = useCallback(
    (type: "succes" | "info" | "erreur", texte: string) =>
      setToast({ id: Date.now(), type, texte }),
    [],
  );
  const fermerToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (loading) return;

    if (!connecte) {
      router.replace("/login");
      return;
    }

    let annule = false;
    const path = role === "producteur" ? "/mes-ventes" : "/mes-achats";

    setFetching(true);
    setError("");

    api<Transaction[]>(path, { token })
      .then((resultat) => {
        if (!annule) setTransactions(resultat);
      })
      .catch((err) => {
        if (!annule) setError(messageFromError(err));
      })
      .finally(() => {
        if (!annule) setFetching(false);
      });

    return () => {
      annule = true;
    };
  }, [loading, connecte, role, token, router]);

  // Échap ferme la fenêtre de confirmation
  useEffect(() => {
    if (!aAnnuler) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && busyId === null) setAAnnuler(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aAnnuler, busyId]);

  async function confirmerAnnulation() {
    const t = aAnnuler;
    if (!t) return;

    setBusyId(t.id);
    setError("");

    try {
      await api(`/transactions/${t.id}/annuler`, { method: "POST", token });
    } catch (err) {
      setError(messageFromError(err));
      setBusyId(null);
      setAAnnuler(null);
      return;
    }

    setTransactions((prev) =>
      prev.map((x) => (x.id === t.id ? { ...x, statut: "annulee" } : x)),
    );
    setAAnnuler(null);
    setBusyId(null);
    setFlashId(t.id);
    setTimeout(() => setFlashId(null), 2000);
    notifier("info", "Commande annulée. Vous avez été remboursé.");

    // Les crédits ont changé : on met à jour le solde sans bloquer l'écran.
    try {
      await refreshUser();
    } catch {
      /* non bloquant */
    }
  }

  // Télécharge un fichier protégé par le token, sous le nom donné
  async function telecharger(chemin: string, nomFichier: string) {
    const res = await fetch(`${API_URL}${chemin}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("echec");

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nomFichier;
    a.click();
    // Révocation différée : certains navigateurs annulent le téléchargement sinon.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function telechargerRecu(t: Transaction) {
    setError("");
    try {
      await telecharger(
        `/transactions/${t.id}/recu`,
        `recu-transaction-${t.id}.pdf`,
      );
      notifier("succes", "Reçu téléchargé.");
    } catch {
      setError("Impossible de télécharger le reçu.");
    }
  }

  async function exporterCsv() {
    setError("");
    setExportEnCours(true);
    try {
      const jour = new Date().toISOString().slice(0, 10);
      await telecharger("/transactions/export", `transactions-${jour}.csv`);
      notifier("succes", "Historique exporté en CSV.");
    } catch {
      setError("Impossible d’exporter l’historique.");
    } finally {
      setExportEnCours(false);
    }
  }

  if (loading || !user) {
    return (
      <main className="transactions-loading">
        <span className="transactions-spinner" aria-hidden="true" />
        <p>Chargement de votre espace…</p>
      </main>
    );
  }

  const estProducteur = user.role === "producteur";

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
          <Link href="/offres">Offres</Link>
          {estProducteur && <Link href="/installation">Mon installation</Link>}
          {estProducteur && <Link href="/commandes">Commandes</Link>}
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
            <span className="transactions-eyebrow">VOTRE ACTIVITÉ</span>
            <h1>{estProducteur ? "Mes ventes" : "Mes achats"}</h1>
            <p>Retrouvez ici l’historique de vos échanges d’énergie.</p>
          </div>

          <div className="transactions-heading-actions">
            {transactions.length > 0 && (
              <button
                type="button"
                onClick={exporterCsv}
                disabled={exportEnCours}
                className="transactions-action-btn"
              >
                {exportEnCours ? "Export…" : "Exporter en CSV"}
              </button>
            )}

            <div className="transactions-count">
              <span>
                <NombreAnime valeur={transactions.length} depuis={0} duree={700} />
              </span>
              <small>
                {transactions.length === 1 ? "transaction" : "transactions"}
              </small>
            </div>
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
            <p>Récupération de vos transactions…</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="transactions-empty">
            <div className="transactions-empty-icon" aria-hidden="true">
              ↗
            </div>
            <h2>Aucune transaction pour le moment</h2>
            <p>
              {estProducteur
                ? "Vos ventes apparaîtront ici dès qu’une offre sera achetée."
                : "Vos achats apparaîtront ici après votre première commande."}
            </p>
            <Link href="/offres" className="transactions-action">
              Découvrir les offres <span aria-hidden="true">→</span>
            </Link>
          </div>
        ) : (
          <>
            <div className="transactions-table-wrap">
              <table className="transactions-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>{estProducteur ? "Acheteur" : "Offre"}</th>
                    <th>Quantité</th>
                    <th>Total</th>
                    <th>Statut</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => (
                    <tr
                      key={transaction.id}
                      className={
                        flashId === transaction.id
                          ? "transaction-row-flash"
                          : undefined
                      }
                    >
                      <td data-label="Date">
                        {new Date(transaction.created_at).toLocaleString(
                          "fr-FR",
                          {
                            dateStyle: "medium",
                            timeStyle: "short",
                          },
                        )}
                      </td>
                      <td data-label={estProducteur ? "Acheteur" : "Offre"}>
                        {estProducteur
                          ? transaction.consommateur?.name || "Acheteur"
                          : `Offre #${transaction.offre_id}`}
                      </td>
                      <td data-label="Quantité">
                        {transaction.quantite_kwh} kWh
                      </td>
                      <td data-label="Total" className="transactions-total">
                        {transaction.prix_total} crédits
                      </td>
                      <td data-label="Statut">
                        {/* key = statut : l'animation rejoue quand le statut change */}
                        <span
                          key={String(transaction.statut)}
                          className={`transactions-status transactions-status-${classeStatut(
                            transaction.statut,
                          )}`}
                        >
                          {libelleStatut(transaction.statut)}
                        </span>
                      </td>
                      <td data-label="Action">
                        {!estProducteur && transaction.statut === "en_attente" && (
                          <button
                            type="button"
                            disabled={busyId === transaction.id}
                            onClick={() => setAAnnuler(transaction)}
                            className="transactions-action-btn"
                          >
                            Annuler
                          </button>
                        )}
                        {transaction.statut === "confirmee" && (
                          <button
                            type="button"
                            onClick={() => telechargerRecu(transaction)}
                            className="transactions-action-btn"
                          >
                            Reçu PDF
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="transactions-footnote">
              Les montants et statuts sont affichés selon les informations de
              votre compte.
            </p>
          </>
        )}
      </section>

      {aAnnuler && (
        <div
          className="confirm-overlay"
          onClick={() => busyId === null && setAAnnuler(null)}
        >
          <div
            className="confirm-carte"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-titre"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="confirm-icone" aria-hidden="true">
              ↺
            </div>
            <h2 id="confirm-titre">Annuler cette commande ?</h2>
            <p>
              {aAnnuler.quantite_kwh} kWh · {aAnnuler.prix_total} crédits.
              Vous serez remboursé.
            </p>
            <div className="confirm-actions">
              <button
                type="button"
                className="confirm-non"
                disabled={busyId !== null}
                onClick={() => setAAnnuler(null)}
              >
                Garder
              </button>
              <button
                type="button"
                className="confirm-oui"
                disabled={busyId !== null}
                onClick={confirmerAnnulation}
              >
                {busyId !== null ? "Annulation…" : "Oui, annuler"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} onClose={fermerToast} />
    </main>
  );
}