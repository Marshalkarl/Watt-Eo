"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { api, messageFromError } from "@/lib/api";
import type { Transaction } from "@/lib/types";

export default function TransactionsPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [error, setError] = useState("");
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    const path =
      user.role === "producteur" ? "/mes-ventes" : "/mes-achats";

    setFetching(true);
    setError("");

    api<Transaction[]>(path, { token })
      .then(setTransactions)
      .catch((err) => setError(messageFromError(err)))
      .finally(() => setFetching(false));
  }, [loading, user, token, router]);

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

        <nav className="transactions-nav" aria-label="Navigation principale">
          <Link href="/dashboard">Tableau de bord</Link>
          <Link href="/offres">Offres</Link>
        </nav>
      </header>

      <section className="transactions-content">
        <div className="transactions-heading">
          <div>
            <span className="transactions-eyebrow">VOTRE ACTIVITÉ</span>
            <h1>{estProducteur ? "Mes ventes" : "Mes achats"}</h1>
            <p>Retrouvez ici l’historique de vos échanges d’énergie.</p>
          </div>

          <div className="transactions-count">
            <span>{transactions.length}</span>
            <small>
              {transactions.length === 1 ? "transaction" : "transactions"}
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
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => (
                    <tr key={transaction.id}>
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
                        <span
                          className={`transactions-status transactions-status-${String(
                            transaction.statut,
                          )
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, "-")}`}
                        >
                          {transaction.statut}
                        </span>
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
    </main>
  );
}