"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { api, messageFromError } from "@/lib/api";
import type { Transaction } from "@/lib/types";

export default function CommandesPage() {
  const { user, token, loading, refreshUser } = useAuth();
  const router = useRouter();
  const [commandes, setCommandes] = useState<Transaction[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const charger = useCallback(async () => {
    if (!token) return;
    try {
      setCommandes(await api<Transaction[]>("/commandes-en-attente", { token }));
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
    charger();
  }, [loading, user, router, charger]);

  async function confirmer(t: Transaction) {
    setBusyId(t.id);
    setError("");
    try {
      await api(`/transactions/${t.id}/confirmer`, { method: "POST", token });
      await Promise.all([charger(), refreshUser()]);
    } catch (err) {
      setError(messageFromError(err));
    } finally {
      setBusyId(null);
    }
  }

  async function refuser(t: Transaction) {
    const motif = prompt("Motif du refus (facultatif) :") ?? undefined;
    setBusyId(t.id);
    setError("");
    try {
      await api(`/transactions/${t.id}/refuser`, {
        method: "POST",
        token,
        body: { motif },
      });
      await charger();
    } catch (err) {
      setError(messageFromError(err));
    } finally {
      setBusyId(null);
    }
  }

  if (loading || !user) return <p className="page">Chargement...</p>;

  return (
    <main className="page">
      <h1>Commandes en attente</h1>
      {error && <p className="msg-err">{error}</p>}

      {fetching ? (
        <p>Chargement...</p>
      ) : commandes.length === 0 ? (
        <p>Aucune commande en attente.</p>
      ) : (
        <div className="grid">
          {commandes.map((c) => (
            <div key={c.id} className="card">
              <h3>{c.consommateur?.name}</h3>
              <p>Offre #{c.offre_id}</p>
              <p>{c.quantite_kwh} kWh — {c.prix_total} crédits</p>
              <div className="buy-row">
                <button disabled={busyId === c.id} onClick={() => confirmer(c)}>
                  Confirmer
                </button>
                <button
                  className="secondary"
                  disabled={busyId === c.id}
                  onClick={() => refuser(c)}
                >
                  Refuser
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}