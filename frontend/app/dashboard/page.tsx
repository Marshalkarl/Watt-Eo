"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
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
import type { DashboardData } from "@/lib/types";
import NotificationBell from "@/components/NotificationBell";
import NombreAnime from "@/components/NombreAnime";
import AchatReussi from "@/components/AchatReussi";
import Toast, { type ToastData } from "@/components/Toast";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api";

const n = (v: number) =>
  v.toLocaleString("fr-FR", { maximumFractionDigits: 2 });

// "2026-09-30" -> "30/09"
const formaterJour = (iso: string) => {
  const [, mois, jour] = iso.split("-");
  return `${jour}/${mois}`;
};

// "2026-09-30" -> "30/09/2026"
const formaterJourComplet = (iso: string) => {
  const [annee, mois, jour] = iso.split("-");
  return `${jour}/${mois}/${annee}`;
};

const PERIODES = [7, 30, 90] as const;

type Stat = {
  label: string;
  valeur: number;
  decimales: number;
  unite?: string;
  icon: string;
};

function construireStats(d: DashboardData): Stat[] {
  if (d.role === "producteur") {
    return [
      { label: "Crédits", valeur: Number(d.credits), decimales: 2, icon: "💳" },
      { label: "Énergie vendue", valeur: Number(d.kwh_vendus), decimales: 2, unite: "kWh", icon: "⚡" },
      { label: "Revenus nets", valeur: Number(d.revenus), decimales: 2, unite: "crédits", icon: "💰" },
      { label: "Commissions Watt-Eo", valeur: Number(d.commissions), decimales: 2, unite: "crédits", icon: "🏷️" },
      { label: "Nombre de ventes", valeur: Number(d.nombre_ventes), decimales: 0, icon: "📊" },
      { label: "Offres actives", valeur: Number(d.offres_actives), decimales: 0, icon: "☀️" },
      { label: "Énergie en vente", valeur: Number(d.kwh_en_vente), decimales: 2, unite: "kWh", icon: "🔋" },
      { label: "CO₂ évité", valeur: Number(d.co2_evite_kg), decimales: 2, unite: "kg", icon: "🌱" },
    ];
  }

  return [
    { label: "Crédits", valeur: Number(d.credits), decimales: 2, icon: "💳" },
    { label: "Énergie achetée", valeur: Number(d.kwh_achetes), decimales: 2, unite: "kWh", icon: "⚡" },
    { label: "Dépenses", valeur: Number(d.depenses), decimales: 2, unite: "crédits", icon: "🧾" },
    { label: "Économies vs réseau", valeur: Number(d.economies), decimales: 2, unite: "crédits", icon: "📉" },
    { label: "Nombre d’achats", valeur: Number(d.nombre_achats), decimales: 0, icon: "🛍️" },
    { label: "CO₂ évité", valeur: Number(d.co2_evite_kg), decimales: 2, unite: "kg", icon: "🌱" },
  ];
}

function GraphiqueJournalier({
  titre,
  donnees,
  cle,
  nom,
}: {
  titre: string;
  donnees: { jour: string; kwh: number; total: number }[];
  cle: "kwh" | "total";
  nom: string;
}) {
  const gradient = `degrade-${cle}`;

  return (
    <section className="dashboard-chart-card">
      <div className="dashboard-chart-heading">
        <div>
          <span className="dashboard-section-kicker">ÉVOLUTION</span>
          <h2>{titre}</h2>
        </div>
        <span className="dashboard-chart-icon" aria-hidden="true">
          ▥
        </span>
      </div>

      <div className="dashboard-chart-box">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={donnees}
            margin={{ top: 12, right: 8, left: -16, bottom: 0 }}
          >
            <defs>
              <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4caf6a" />
                <stop offset="100%" stopColor="#21834d" />
              </linearGradient>
            </defs>
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
              labelFormatter={(label) => formaterJourComplet(String(label))}
              contentStyle={{
                border: "1px solid #e2ebe4",
                borderRadius: 12,
                boxShadow: "0 8px 24px rgba(24, 65, 42, 0.08)",
              }}
            />
            <Bar
              dataKey={cle}
              name={nom}
              fill={`url(#${gradient})`}
              radius={[6, 6, 0, 0]}
              maxBarSize={24}
              isAnimationActive
              animationDuration={900}
              animationEasing="ease-out"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

export default function DashboardPage() {
  const { user, token, loading, logout, refreshUser } = useAuth();
  const router = useRouter();

  const [data, setData] = useState<DashboardData | null>(null);
  const [jours, setJours] = useState<number>(30);
  const [montant, setMontant] = useState("1000");
  const [error, setError] = useState("");
  const [rechargementEnCours, setRechargementEnCours] = useState(false);
  const [recharge, setRecharge] = useState<number | null>(null);
  const [toast, setToast] = useState<ToastData>(null);
  const [moisRapport, setMoisRapport] = useState(
    new Date().toLocaleDateString("sv-SE").slice(0, 7), // « 2026-10 », heure locale
  );
  const [rapportEnCours, setRapportEnCours] = useState(false);

  // Ignore les réponses arrivées en retard (changement rapide de période).
  const requeteRef = useRef(0);

  const fermerRecharge = useCallback(() => setRecharge(null), []);
  const fermerToast = useCallback(() => setToast(null), []);

  const charger = useCallback(async () => {
    if (!token || user?.role === "admin") return;

    const requete = ++requeteRef.current;

    try {
      const resultat = await api<DashboardData>(`/dashboard?jours=${jours}`, {
        token,
      });
      if (requete !== requeteRef.current) return;
      setError("");
      setData(resultat);
    } catch (err) {
      if (requete !== requeteRef.current) return;
      setError(messageFromError(err));
    }
  }, [token, jours, user?.role]);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (user.role === "admin") router.replace("/admin");
  }, [loading, user, router]);

  useEffect(() => {
    void charger();
  }, [charger]);

  async function recharger(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const valeur = Number(montant);
    if (!Number.isFinite(valeur) || valeur <= 0) {
      setError("Saisissez un montant valide.");
      return;
    }

    setRechargementEnCours(true);

    try {
      await api("/recharger", {
        method: "POST",
        token,
        body: { montant: valeur },
      });
    } catch (err) {
      setError(messageFromError(err));
      setRechargementEnCours(false);
      return;
    }

    // Le rechargement a réussi : on célèbre, puis on met à jour les chiffres.
    setRecharge(valeur);
    setRechargementEnCours(false);

    try {
      await Promise.all([refreshUser(), charger()]);
    } catch {
      /* non bloquant : la recharge est déjà enregistrée */
    }
  }

  async function telechargerRapport(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setRapportEnCours(true);

    try {
      const res = await fetch(
        `${API_URL}/rapport-mensuel?mois=${moisRapport}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/pdf",
          },
        },
      );
      if (!res.ok) throw new Error("echec");

      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `rapport-${moisRapport}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      const [annee, mois] = moisRapport.split("-");
      setToast({
        id: Date.now(),
        type: "succes",
        texte: `Rapport ${mois}/${annee} téléchargé.`,
      });
    } catch {
      setError("Impossible de générer le rapport.");
    } finally {
      setRapportEnCours(false);
    }
  }

  if (loading || !user || user.role === "admin") {
    return (
      <main className="dashboard-loading">
        <span className="dashboard-loader" />
        <p>Préparation de votre espace…</p>
      </main>
    );
  }

  const estProducteur = user.role === "producteur";

  const evolution = (data?.evolution_journaliere ?? []).map((ligne) => ({
    jour: ligne.jour,
    kwh: Number(ligne.kwh),
    total: Number(ligne.total),
  }));

  // L'API renvoie tous les jours (à 0 s'il n'y a rien) : on teste l'activité réelle.
  const aDeLActivite = evolution.some((l) => l.kwh > 0 || l.total > 0);

  return (
    <main className="dashboard-page">
      <header className="dashboard-topbar">
        <Link
          href="/"
          className="dashboard-brand"
          aria-label="Watt-Eo, accueil"
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

        <nav
          className="dashboard-nav"
          aria-label="Navigation du tableau de bord"
        >
          <Link href="/offres">Offres</Link>
          {estProducteur && <Link href="/mes-offres">Mes offres</Link>}
          {estProducteur && <Link href="/installation">Mon installation</Link>}
          {estProducteur && <Link href="/commandes">Commandes</Link>}
          <Link href="/transactions">
            {estProducteur ? "Mes ventes" : "Mes achats"}
          </Link>
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
        </div>
      </header>

      <div className="dashboard-content">
        <section className="dashboard-welcome">
          <div>
            <span className="dashboard-section-kicker">
              VOTRE ESPACE PERSONNEL
            </span>
            <h1>
              Bonjour {user.name} <span aria-hidden="true">👋</span>
            </h1>
            <p>
              Retrouvez ici le suivi de votre activité et votre impact
              énergétique.
            </p>
          </div>

          <span className="dashboard-role">
            <span className="dashboard-role-dot" />
            {estProducteur ? "Producteur" : "Consommateur"}
          </span>
        </section>

        {estProducteur && (
          <section className="dashboard-recharge-card">
            <div className="dashboard-recharge-copy">
              <span className="dashboard-recharge-icon" aria-hidden="true">
                ▤
              </span>
              <div>
                <h2>Rapport mensuel</h2>
                <p>Téléchargez le bilan de vos ventes du mois en PDF.</p>
              </div>
            </div>

            <form
              onSubmit={telechargerRapport}
              className="dashboard-recharge-form"
            >
              <label className="dashboard-input-wrap">
                <span className="sr-only">Mois du rapport</span>
                <input
                  type="month"
                  value={moisRapport}
                  onChange={(e) => setMoisRapport(e.target.value)}
                  required
                />
              </label>
              <button
                type="submit"
                className={rapportEnCours ? "is-loading" : ""}
                aria-busy={rapportEnCours}
                disabled={rapportEnCours}
              >
                {rapportEnCours ? "Génération…" : "Télécharger"}
                {!rapportEnCours && <span aria-hidden="true"> →</span>}
              </button>
            </form>
          </section>
        )}

        {!estProducteur && (
          <section className="dashboard-recharge-card">
            <div className="dashboard-recharge-copy">
              <span className="dashboard-recharge-icon" aria-hidden="true">
                +
              </span>
              <div>
                <h2>Recharger mes crédits</h2>
                <p>
                  Ajoutez des crédits à votre compte pour vos prochains achats.
                </p>
              </div>
            </div>

            <form onSubmit={recharger} className="dashboard-recharge-form">
              <label className="dashboard-input-wrap">
                <span className="sr-only">Montant à recharger</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={montant}
                  onChange={(e) => setMontant(e.target.value)}
                  required
                />
                <span>crédits</span>
              </label>
              <button
                type="submit"
                className={rechargementEnCours ? "is-loading" : ""}
                aria-busy={rechargementEnCours}
                disabled={rechargementEnCours}
              >
                {rechargementEnCours ? "Rechargement…" : "Recharger"}
                {!rechargementEnCours && <span aria-hidden="true"> →</span>}
              </button>
            </form>
          </section>
        )}

        {error && (
          <p className="dashboard-alert dashboard-alert-error" role="alert">
            <span aria-hidden="true">!</span> {error}
          </p>
        )}

        {data ? (
          <>
            <section className="dashboard-section">
              <div className="dashboard-section-heading">
                <div>
                  <span className="dashboard-section-kicker">
                    EN UN COUP D’ŒIL
                  </span>
                  <h2>Vos indicateurs</h2>
                </div>
                <span className="dashboard-updated">
                  Données de votre compte
                </span>
              </div>

              <div className="dashboard-stats">
                {construireStats(data).map((stat) => (
                  <article className="dashboard-stat" key={stat.label}>
                    <span className="dashboard-stat-icon" aria-hidden="true">
                      {stat.icon}
                    </span>
                    <span className="dashboard-stat-label">{stat.label}</span>
                    <strong className="dashboard-stat-value">
                      <NombreAnime
                        valeur={stat.valeur}
                        decimales={stat.decimales}
                        depuis={0}
                        fixe={false}
                      />
                      {stat.unite ? ` ${stat.unite}` : ""}
                    </strong>
                  </article>
                ))}
              </div>
            </section>

            <section className="dashboard-section dashboard-evolution">
              <div className="dashboard-section-heading">
                <div>
                  <span className="dashboard-section-kicker">
                    VOTRE ACTIVITÉ
                  </span>
                  <h2>Évolution journalière</h2>
                </div>

                <div
                  role="group"
                  aria-label="Période affichée"
                  className="dashboard-period"
                >
                  {PERIODES.map((j) => (
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

              {!aDeLActivite ? (
                <div className="dashboard-empty">
                  <span aria-hidden="true">📈</span>
                  <h3>Vos graphiques apparaîtront ici</h3>
                  <p>Ils se rempliront après votre première transaction.</p>
                </div>
              ) : (
                <div className="dashboard-charts" key={jours}>
                  <GraphiqueJournalier
                    titre={
                      estProducteur
                        ? `Énergie vendue par jour (kWh) – ${jours} jours`
                        : `Énergie achetée par jour (kWh) – ${jours} jours`
                    }
                    donnees={evolution}
                    cle="kwh"
                    nom="kWh"
                  />
                  <GraphiqueJournalier
                    titre={
                      estProducteur
                        ? `Revenus nets par jour (crédits) – ${jours} jours`
                        : `Dépenses par jour (crédits) – ${jours} jours`
                    }
                    donnees={evolution}
                    cle="total"
                    nom="Crédits"
                  />
                </div>
              )}
            </section>
          </>
        ) : (
          !error && (
            <div className="dashboard-data-loading">
              <span className="dashboard-loader" />
              <p>Chargement de vos données…</p>
            </div>
          )
        )}
      </div>

      <AchatReussi
        open={recharge !== null}
        onClose={fermerRecharge}
        titre="Recharge effectuée !"
        message="Votre compte a été rechargé (simulation)."
        details={
          recharge !== null
            ? [{ label: "Crédits ajoutés", valeur: `+ ${n(recharge)} crédits` }]
            : []
        }
      />

      <Toast toast={toast} onClose={fermerToast} />
    </main>
  );
}