"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "@/context/AuthContext";
import { api, messageFromError } from "@/lib/api";
import type {
  AdminDashboard,
  AdminUser,
  AuditEntry,
  Offre,
  Paginated,
  Transaction,
} from "@/lib/types";

const n = (v: number | string) =>
  Number(v).toLocaleString("fr-FR", { maximumFractionDigits: 2 });

const formaterJour = (iso: string) => {
  const [, mois, jour] = iso.split("-");
  return `${jour}/${mois}`;
};

const formaterDate = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR");

const STATUTS: Record<string, string> = {
  en_attente: "En attente",
  confirmee: "Confirmée",
  annulee: "Annulée",
};

type Onglet = "utilisateurs" | "transactions" | "offres" | "journal";

function Pager({
  page,
  last,
  total,
  onChange,
}: {
  page: number;
  last: number;
  total: number;
  onChange: (p: number) => void;
}) {
  return (
    <div className="admin-pager">
      <span>{total} résultat(s)</span>
      <div>
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          ← Précédent
        </button>
        <span>
          {" "}
          Page {page} / {Math.max(last, 1)}{" "}
        </span>
        <button
          type="button"
          disabled={page >= last}
          onClick={() => onChange(page + 1)}
        >
          Suivant →
        </button>
      </div>
    </div>
  );
}

function UtilisateursTab({ token }: { token: string }) {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [recherche, setRecherche] = useState("");
  const [res, setRes] = useState<Paginated<AdminUser> | null>(null);
  const [error, setError] = useState("");

  const charger = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (recherche) params.set("q", recherche);
      setRes(
        await api<Paginated<AdminUser>>(`/admin/utilisateurs?${params}`, {
          token,
        }),
      );
      setError("");
    } catch (err) {
      setError(messageFromError(err));
    }
  }, [token, page, recherche]);

  useEffect(() => {
    void charger();
  }, [charger]);

  async function changerEtat(u: AdminUser) {
    if (u.actif && !window.confirm(`Suspendre le compte de ${u.name} ?`)) {
      return;
    }
    try {
      await api(
        `/admin/utilisateurs/${u.id}/${u.actif ? "suspendre" : "reactiver"}`,
        { method: "POST", token },
      );
      await charger();
    } catch (err) {
      setError(messageFromError(err));
    }
  }

  function rechercher(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPage(1);
    setRecherche(q.trim());
  }

  return (
    <div>
      <form className="admin-toolbar" onSubmit={rechercher}>
        <input
          type="search"
          placeholder="Nom ou email"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="submit">Rechercher</button>
      </form>

      {error && (
        <p className="dashboard-alert dashboard-alert-error" role="alert">
          {error}
        </p>
      )}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Email</th>
              <th>Rôle</th>
              <th>Crédits</th>
              <th>Inscrit le</th>
              <th>État</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {res?.data.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td>{n(u.credits)}</td>
                <td>{formaterDate(u.created_at)}</td>
                <td>
                  <span className={`admin-badge ${u.actif ? "" : "is-off"}`}>
                    {u.actif ? "Actif" : "Suspendu"}
                  </span>
                </td>
                <td className="admin-actions">
                  {u.role !== "admin" && (
                    <button type="button" onClick={() => changerEtat(u)}>
                      {u.actif ? "Suspendre" : "Réactiver"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {res && (
        <Pager
          page={res.current_page}
          last={res.last_page}
          total={res.total}
          onChange={setPage}
        />
      )}
    </div>
  );
}

function TransactionsTab({ token }: { token: string }) {
  const [page, setPage] = useState(1);
  const [statut, setStatut] = useState("");
  const [res, setRes] = useState<Paginated<Transaction> | null>(null);
  const [error, setError] = useState("");

  const charger = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (statut) params.set("statut", statut);
      setRes(
        await api<Paginated<Transaction>>(`/admin/transactions?${params}`, {
          token,
        }),
      );
      setError("");
    } catch (err) {
      setError(messageFromError(err));
    }
  }, [token, page, statut]);

  useEffect(() => {
    void charger();
  }, [charger]);

  return (
    <div>
      <div className="admin-toolbar">
        <select
          value={statut}
          onChange={(e) => {
            setPage(1);
            setStatut(e.target.value);
          }}
        >
          <option value="">Tous les statuts</option>
          <option value="en_attente">En attente</option>
          <option value="confirmee">Confirmées</option>
          <option value="annulee">Annulées</option>
        </select>
      </div>

      {error && (
        <p className="dashboard-alert dashboard-alert-error" role="alert">
          {error}
        </p>
      )}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Date</th>
              <th>Producteur</th>
              <th>Acheteur</th>
              <th>kWh</th>
              <th>Total</th>
              <th>Commission</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {res?.data.map((t) => (
              <tr key={t.id}>
                <td>{t.id}</td>
                <td>{formaterDate(t.created_at)}</td>
                <td>{t.offre?.producteur?.name ?? "—"}</td>
                <td>{t.consommateur?.name ?? "—"}</td>
                <td>{n(t.quantite_kwh)}</td>
                <td>{n(t.prix_total)}</td>
                <td>{n(t.commission ?? 0)}</td>
                <td>
                  <span
                    className={`admin-badge ${
                      t.statut === "annulee"
                        ? "is-off"
                        : t.statut === "en_attente"
                          ? "is-wait"
                          : ""
                    }`}
                  >
                    {STATUTS[t.statut] ?? t.statut}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {res && (
        <Pager
          page={res.current_page}
          last={res.last_page}
          total={res.total}
          onChange={setPage}
        />
      )}
    </div>
  );
}

function OffresTab({ token }: { token: string }) {
  const [page, setPage] = useState(1);
  const [retirees, setRetirees] = useState(false);
  const [res, setRes] = useState<Paginated<Offre> | null>(null);
  const [error, setError] = useState("");

  const charger = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (retirees) params.set("retirees", "1");
      setRes(
        await api<Paginated<Offre>>(`/admin/offres?${params}`, { token }),
      );
      setError("");
    } catch (err) {
      setError(messageFromError(err));
    }
  }, [token, page, retirees]);

  useEffect(() => {
    void charger();
  }, [charger]);

  async function retirer(o: Offre) {
    const motif = window.prompt("Motif du retrait de cette offre :");
    if (!motif || !motif.trim()) return;
    try {
      await api(`/admin/offres/${o.id}/retirer`, {
        method: "POST",
        token,
        body: { motif: motif.trim() },
      });
      await charger();
    } catch (err) {
      setError(messageFromError(err));
    }
  }

  async function remettre(o: Offre) {
    try {
      await api(`/admin/offres/${o.id}/remettre`, { method: "POST", token });
      await charger();
    } catch (err) {
      setError(messageFromError(err));
    }
  }

  return (
    <div>
      <div className="admin-toolbar">
        <label>
          <input
            type="checkbox"
            checked={retirees}
            onChange={(e) => {
              setPage(1);
              setRetirees(e.target.checked);
            }}
          />{" "}
          Afficher seulement les offres retirées
        </label>
      </div>

      {error && (
        <p className="dashboard-alert dashboard-alert-error" role="alert">
          {error}
        </p>
      )}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Producteur</th>
              <th>Source</th>
              <th>kWh</th>
              <th>Prix / kWh</th>
              <th>État</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {res?.data.map((o) => {
              const retiree = Boolean(o.retiree);
              return (
                <tr key={o.id}>
                  <td>{o.id}</td>
                  <td>{o.producteur?.name ?? "—"}</td>
                  <td>{o.source}</td>
                  <td>{n(o.quantite_kwh)}</td>
                  <td>{n(o.prix_kwh)}</td>
                  <td>
                    {retiree ? (
                      <span
                        className="admin-badge is-off"
                        title={o.motif_retrait ?? ""}
                      >
                        Retirée
                      </span>
                    ) : (
                      <span className="admin-badge">
                        {o.disponible ? "En vente" : "Indisponible"}
                      </span>
                    )}
                  </td>
                  <td className="admin-actions">
                    {retiree ? (
                      <button type="button" onClick={() => remettre(o)}>
                        Remettre
                      </button>
                    ) : (
                      <button type="button" onClick={() => retirer(o)}>
                        Retirer
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {res && (
        <Pager
          page={res.current_page}
          last={res.last_page}
          total={res.total}
          onChange={setPage}
        />
      )}
    </div>
  );
}

const ACTIONS: Record<string, string> = {
  inscription: "Inscription",
  connexion: "Connexion",
  connexion_echec: "Connexion échouée",
  connexion_refusee_suspendu: "Connexion refusée (compte suspendu)",
  deconnexion: "Déconnexion",
  achat: "Achat",
  commande_confirmee: "Commande confirmée",
  commande_refusee: "Commande refusée",
  commande_annulee: "Commande annulée",
  recharge: "Recharge de crédits",
  offre_creee: "Offre publiée",
  offre_modifiee: "Offre modifiée",
  offre_supprimee: "Offre supprimée",
  compte_suspendu: "Compte suspendu",
  compte_reactive: "Compte réactivé",
  offre_retiree: "Offre retirée",
  offre_remise: "Offre remise en vente",
};

function resumeDetails(d: Record<string, unknown> | null) {
  if (!d) return "—";
  return Object.entries(d)
    .map(([k, v]) => `${k} : ${String(v)}`)
    .join(" · ");
}

function JournalTab({ token }: { token: string }) {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [res, setRes] = useState<Paginated<AuditEntry> | null>(null);
  const [error, setError] = useState("");

  const charger = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (action) params.set("action", action);
      setRes(
        await api<Paginated<AuditEntry>>(`/admin/journal?${params}`, { token }),
      );
      setError("");
    } catch (err) {
      setError(messageFromError(err));
    }
  }, [token, page, action]);

  useEffect(() => {
    void charger();
  }, [charger]);

  return (
    <div>
      <div className="admin-toolbar">
        <select
          value={action}
          onChange={(e) => {
            setPage(1);
            setAction(e.target.value);
          }}
        >
          <option value="">Toutes les actions</option>
          {Object.entries(ACTIONS).map(([valeur, libelle]) => (
            <option key={valeur} value={valeur}>
              {libelle}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => void charger()}>
          Actualiser
        </button>
      </div>

      {error && (
        <p className="dashboard-alert dashboard-alert-error" role="alert">
          {error}
        </p>
      )}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Compte</th>
              <th>Action</th>
              <th>Cible</th>
              <th>Détails</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {res?.data.map((l) => (
              <tr key={l.id}>
                <td>{new Date(l.created_at).toLocaleString("fr-FR")}</td>
                <td>{l.user ? `${l.user.name} (${l.user.role})` : "—"}</td>
                <td>
                  <span
                    className={`admin-badge ${
                      l.action.includes("echec") || l.action.includes("suspendu")
                        ? "is-off"
                        : ""
                    }`}
                  >
                    {ACTIONS[l.action] ?? l.action}
                  </span>
                </td>
                <td>{l.cible_type ? `${l.cible_type} #${l.cible_id}` : "—"}</td>
                <td>{resumeDetails(l.details)}</td>
                <td>{l.ip ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {res && (
        <Pager
          page={res.current_page}
          last={res.last_page}
          total={res.total}
          onChange={setPage}
        />
      )}
    </div>
  );
}

export default function AdminPage() {
  const { user, token, loading, logout } = useAuth();
  const router = useRouter();

  const [data, setData] = useState<AdminDashboard | null>(null);
  const [jours, setJours] = useState<number>(30);
  const [onglet, setOnglet] = useState<Onglet>("utilisateurs");
  const [error, setError] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (user.role !== "admin") router.replace("/dashboard");
  }, [loading, user, router]);

  const charger = useCallback(async () => {
    if (!token || user?.role !== "admin") return;
    try {
      setData(
        await api<AdminDashboard>(`/admin/dashboard?jours=${jours}`, {
          token,
        }),
      );
      setError("");
    } catch (err) {
      setError(messageFromError(err));
    }
  }, [token, user?.role, jours]);

  useEffect(() => {
    void charger();
  }, [charger]);

  if (loading || !user || user.role !== "admin" || !token) {
    return (
      <main className="dashboard-loading">
        <span className="dashboard-loader" />
        <p>Chargement…</p>
      </main>
    );
  }

  const stats = data
    ? [
        { label: "Commissions totales", value: `${n(data.commissions_totales)} crédits`, icon: "🏷️" },
        { label: "Volume échangé", value: `${n(data.volume_credits)} crédits`, icon: "💰" },
        { label: "Énergie échangée", value: `${n(data.kwh_echanges)} kWh`, icon: "⚡" },
        { label: "CO₂ évité", value: `${n(data.co2_evite_kg)} kg`, icon: "🌱" },
        { label: "Producteurs", value: n(data.utilisateurs.producteurs), icon: "☀️" },
        { label: "Consommateurs", value: n(data.utilisateurs.consommateurs), icon: "🏠" },
        { label: "Comptes suspendus", value: n(data.utilisateurs.suspendus), icon: "⛔" },
        { label: "Offres actives", value: `${n(data.offres.actives)} / ${n(data.offres.total)}`, icon: "🔋" },
        { label: "Ventes confirmées", value: n(data.transactions.confirmees), icon: "✅" },
        { label: "En attente", value: n(data.transactions.en_attente), icon: "⏳" },
        { label: "Annulées", value: n(data.transactions.annulees), icon: "✖️" },
      ]
    : [];

  return (
    <main className="dashboard-page">
      <header className="dashboard-topbar">
        <Link href="/" className="dashboard-brand" aria-label="Watt-Eo, accueil">
          <Image
            src="/images/Watt-Eo-logo.png"
            alt="Watt-Eo"
            width={160}
            height={48}
            priority
            className="home-brand-logo"
          />
        </Link>

        <nav className="dashboard-nav" aria-label="Navigation administrateur">
            <Link href="/admin">Administration</Link>
            <Link href="/offres">Offres</Link>
            </nav>

        <button
          className="dashboard-logout"
          type="button"
          onClick={async () => {
            await logout();
            router.push("/login");
          }}
        >
          <span aria-hidden="true">↗</span>
          <span>Se déconnecter</span>
        </button>
      </header>

      <div className="dashboard-content">
        <section className="dashboard-welcome">
          <div>
            <span className="dashboard-section-kicker">ADMINISTRATION</span>
            <h1>Tableau de bord de la plateforme</h1>
            <p>Suivez l’activité, gérez les comptes et modérez les offres.</p>
          </div>
          <span className="dashboard-role">
            <span className="dashboard-role-dot" />
            Administrateur
          </span>
        </section>

        {error && (
          <p className="dashboard-alert dashboard-alert-error" role="alert">
            {error}
          </p>
        )}

        {data ? (
          <>
            <section className="dashboard-section">
              <div className="dashboard-stats">
                {stats.map((s) => (
                  <article className="dashboard-stat" key={s.label}>
                    <span className="dashboard-stat-icon" aria-hidden="true">
                      {s.icon}
                    </span>
                    <span className="dashboard-stat-label">{s.label}</span>
                    <strong className="dashboard-stat-value">{s.value}</strong>
                  </article>
                ))}
              </div>
            </section>

            <section className="dashboard-section">
              <div className="dashboard-section-heading">
                <div>
                  <span className="dashboard-section-kicker">REVENUS</span>
                  <h2>Commissions par jour</h2>
                </div>
                <div
                  role="group"
                  aria-label="Période affichée"
                  className="dashboard-period"
                >
                  {[7, 30, 90].map((j) => (
                    <button
                      key={j}
                      type="button"
                      onClick={() => setJours(j)}
                      aria-pressed={jours === j}
                      className={jours === j ? "is-active" : ""}
                    >
                      {j} jours
                    </button>
                  ))}
                </div>
              </div>

              <section className="dashboard-chart-card">
                <div className="dashboard-chart-box">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.evolution_journaliere}
                      margin={{ top: 12, right: 8, left: -16, bottom: 0 }}
                    >
                      <CartesianGrid
                        stroke="#e8efe9"
                        strokeDasharray="4 4"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="jour"
                        tickFormatter={formaterJour}
                        minTickGap={16}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#718078", fontSize: 12 }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#718078", fontSize: 12 }}
                      />
                      <Tooltip
                        cursor={{ fill: "#f0f7f1" }}
                        labelFormatter={(l) => formaterJour(String(l))}
                      />
                      <Bar
                        dataKey="commissions"
                        name="Commissions"
                        fill="#21834d"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={24}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </section>
          </>
        ) : (
          !error && (
            <div className="dashboard-data-loading">
              <span className="dashboard-loader" />
              <p>Chargement des données…</p>
            </div>
          )
        )}

        <section className="dashboard-section">
          <div className="admin-tabs" role="tablist">
            {(["utilisateurs", "transactions", "offres", "journal"] as Onglet[]).map(
                    (o) => (
                 <button
                   key={o}
                     type="button"
                     role="tab"
                      aria-selected={onglet === o}
                      className={onglet === o ? "is-active" : ""}
                      onClick={() => setOnglet(o)}
                     >
                      {o === "utilisateurs"
                        ? "Utilisateurs"
                       : o === "transactions"
                         ? "Transactions"
                           : o === "offres"
                            ? "Offres"
                              : "Journal"}
                </button>
                    ),
                )}
          </div>

          {onglet === "utilisateurs" && <UtilisateursTab token={token} />}
          {onglet === "transactions" && <TransactionsTab token={token} />}
          {onglet === "offres" && <OffresTab token={token} />}
          {onglet === "journal" && <JournalTab token={token} />}
        </section>
      </div>
    </main>
  );
}