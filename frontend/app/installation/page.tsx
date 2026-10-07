"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "@/context/AuthContext";
import { api, messageFromError } from "@/lib/api";
import type { BilanEnergie, Compteur, HistoriqueReleves } from "@/lib/types";
import styles from "./installation.module.css";

type PointJour = { jour: string; production: number; consommation: number };

const LIBELLES_SOURCE: Record<string, string> = {
  solaire: "Solaire",
  eolien: "Éolien",
  hydraulique: "Hydraulique",
  biomasse: "Biomasse",
};

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const fmt = (n: number) =>
  n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });

async function chargerSerie(
  compteurs: Compteur[],
  nbJours: number,
  token: string | null,
): Promise<PointJour[]> {
  const fin = new Date();
  const debut = new Date();
  debut.setDate(fin.getDate() - (nbJours - 1));

  const parJour = new Map<string, PointJour>();
  for (let i = 0; i < nbJours; i++) {
    const d = new Date(debut);
    d.setDate(debut.getDate() + i);
    parJour.set(iso(d), { jour: iso(d), production: 0, consommation: 0 });
  }

  const requete = `pas=jour&debut=${iso(debut)}&fin=${iso(fin)}`;
  const reponses = await Promise.all(
    compteurs
      .filter((c) => c.actif)
      .map((c) =>
        api<HistoriqueReleves>(`/compteurs/${c.id}/releves?${requete}`, { token }),
      ),
  );

  for (const reponse of reponses) {
    for (const ligne of reponse.releves) {
      const point = parJour.get(ligne.periode);
      if (point) point[reponse.compteur.type] += Number(ligne.energie_kwh);
    }
  }

  return Array.from(parJour.values()).map((p) => ({
    ...p,
    production: Math.round(p.production * 100) / 100,
    consommation: Math.round(p.consommation * 100) / 100,
  }));
}

export default function InstallationPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();

  const [compteurs, setCompteurs] = useState<Compteur[]>([]);
  const [bilan, setBilan] = useState<BilanEnergie | null>(null);
  const [serie, setSerie] = useState<PointJour[]>([]);
  const [jours, setJours] = useState(30);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);

  const [form, setForm] = useState({
    nom: "",
    type: "production",
    source: "solaire",
    puissance_kwc: "",
  });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [rech, setRech] = useState({ compteur_id: "", kwh: "" });
  const [rechMsg, setRechMsg] = useState("");
  const [rechError, setRechError] = useState("");
  const [recharging, setRecharging] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role !== "producteur") {
      router.replace("/dashboard");
    }
  }, [loading, user, router]);

  const charger = useCallback(async () => {
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      const [cs, b] = await Promise.all([
        api<Compteur[]>("/compteurs", { token }),
        api<BilanEnergie>("/energie/bilan?jours=30", { token }),
      ]);
      setCompteurs(cs);
      setBilan(b);
      setSerie(await chargerSerie(cs, jours, token));
    } catch (err) {
      setError(messageFromError(err));
    } finally {
      setBusy(false);
    }
  }, [token, jours]);

  useEffect(() => {
    if (!loading && user?.role === "producteur") charger();
  }, [loading, user, charger]);

  async function onCreer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      await api<Compteur>("/compteurs", {
        method: "POST",
        token,
        body: {
          nom: form.nom.trim(),
          type: form.type,
          ...(form.type === "production"
            ? { source: form.source, puissance_kwc: Number(form.puissance_kwc) }
            : {}),
        },
      });
      setForm({ nom: "", type: "production", source: "solaire", puissance_kwc: "" });
      await charger();
    } catch (err) {
      setFormError(messageFromError(err));
    } finally {
      setSaving(false);
    }
  }

  async function onRecharger(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRechError("");
    setRechMsg("");
    setRecharging(true);
    try {
      const id = rech.compteur_id || String(compteursProd[0]?.id);
      const res = await api<{ message: string; bilan: BilanEnergie }>(
        `/compteurs/${id}/recharger`,
        { method: "POST", token, body: { kwh: Number(rech.kwh) } },
      );
      setRechMsg(res.message);
      setRech({ ...rech, kwh: "" });
      await charger();
    } catch (err) {
      setRechError(messageFromError(err));
    } finally {
      setRecharging(false);
    }
  }

  async function onSupprimer(c: Compteur) {
    if (!confirm(`Supprimer « ${c.nom} » et tous ses relevés ?`)) return;
    setError("");
    try {
      await api(`/compteurs/${c.id}`, { method: "DELETE", token });
      await charger();
    } catch (err) {
      setError(messageFromError(err));
    }
  }

  if (loading || !user || user.role !== "producteur") {
    return (
      <main className={styles.page}>
        <p className={styles.empty}>Chargement…</p>
      </main>
    );
  }

  const aConsommation = compteurs.some((c) => c.type === "consommation" && c.actif);
  const compteursProd = compteurs.filter((c) => c.type === "production" && c.actif);
  const peutVendre = bilan !== null && bilan.surplus_kwh >= 0.1;
  // Le champ quantité de la page de publication avance par pas de 0,1 : on arrondit vers le bas.
  const quantitePreremplie = bilan ? Math.floor(bilan.surplus_kwh * 10) / 10 : 0;

  return (
    <main className={styles.page}>
     <header className={styles.header}>
         <div>
           <h1>Mon installation</h1>
            <p>Suivez votre production et l’énergie que vous pouvez mettre en vente.</p>
          <nav className={styles.nav} aria-label="Navigation du producteur">
             <Link href="/dashboard" className={styles.navLien}>Tableau de bord</Link>
            <Link href="/mes-offres" className={styles.navLien}>Mes offres</Link>
             <Link href="/commandes" className={styles.navLien}>Commandes</Link>
          </nav>
        </div>
      </header>
      {error && <p className={styles.error} role="alert">{error}</p>}

      {bilan && (
        <section className={styles.cards}>
          <div className={`${styles.card} ${styles.surplus}`}>
            <span>Surplus disponible</span>
            <strong>{fmt(bilan.surplus_kwh)} kWh</strong>
            <small>Sur les 30 derniers jours, après ventes et offres en cours</small>
            <br />
            <Link
              href={`/offres/nouvelle?quantite=${quantitePreremplie}`}
              className={`${styles.action} ${peutVendre ? "" : styles.actionOff}`}
              aria-disabled={!peutVendre}
            >
              Mettre en vente
            </Link>
          </div>

          <div className={styles.card}>
            <span>Production (30 jours)</span>
            <strong>{fmt(bilan.production_kwh)} kWh</strong>
          </div>

          <div className={styles.card}>
            <span>Déjà vendu</span>
            <strong>{fmt(bilan.vendu_kwh)} kWh</strong>
          </div>

          <div className={styles.card}>
            <span>Commandes en attente</span>
            <strong>{fmt(bilan.en_attente_kwh)} kWh</strong>
          </div>

          <div className={styles.card}>
            <span>Actuellement en vente</span>
            <strong>{fmt(bilan.en_vente_kwh)} kWh</strong>
          </div>
        </section>
      )}

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <h2>{aConsommation ? "Production et consommation" : "Production"}</h2>
          <div className={styles.tabs}>
            {[7, 30].map((n) => (
              <button
                key={n}
                type="button"
                className={`${styles.tab} ${jours === n ? styles.tabActive : ""}`}
                onClick={() => setJours(n)}
              >
                {n} jours
              </button>
            ))}
          </div>
        </div>

        {busy && serie.length === 0 ? (
          <p className={styles.empty}>Chargement des relevés…</p>
        ) : (
          <div className={styles.chart}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={serie}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="jour"
                  tickFormatter={(v: string) => `${v.slice(8, 10)}/${v.slice(5, 7)}`}
                />
                <YAxis unit=" kWh" width={70} />
                <Tooltip formatter={(value) => `${fmt(Number(value))} kWh`} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="production"
                  name="Production"
                  stroke="#16a34a"
                  fill="#16a34a"
                  fillOpacity={0.25}
                />
                {aConsommation && (
                  <Area
                    type="monotone"
                    dataKey="consommation"
                    name="Consommation"
                    stroke="#2563eb"
                    fill="#2563eb"
                    fillOpacity={0.2}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <h2>Mes compteurs</h2>
        </div>

        {compteurs.length === 0 ? (
          <p className={styles.empty}>Aucun compteur déclaré pour le moment.</p>
        ) : (
          <ul className={styles.list}>
            {compteurs.map((c) => (
              <li key={c.id} className={styles.item}>
                <span>
                  <strong>{c.nom}</strong>{" "}
                  {c.type === "production" && c.source
                    ? `· ${LIBELLES_SOURCE[c.source] ?? c.source}`
                    : ""}
                  {c.puissance_kwc ? ` · ${fmt(c.puissance_kwc)} kWc` : ""}
                </span>
                <span
                  className={`${styles.badge} ${c.type === "consommation" ? styles.badgeConso : ""}`}
                >
                  {c.type === "production" ? "Production" : "Consommation"}
                </span>
                <button
                  type="button"
                  onClick={() => onSupprimer(c)}
                  aria-label={`Supprimer ${c.nom}`}
                  style={{ marginLeft: "0.75rem", cursor: "pointer" }}
                >
                  Supprimer
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {compteursProd.length > 0 && (
        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Recharger en kWh (simulation)</h2>
          </div>

          <form className={styles.form} onSubmit={onRecharger}>
            <label className={styles.field}>
              <span>Compteur de production</span>
              <select
                value={rech.compteur_id || String(compteursProd[0].id)}
                onChange={(e) => setRech({ ...rech, compteur_id: e.target.value })}
              >
                {compteursProd.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span>Énergie à ajouter (kWh)</span>
              <input
                type="number"
                min="0.01"
                max="1000"
                step="any"
                value={rech.kwh}
                onChange={(e) => setRech({ ...rech, kwh: e.target.value })}
                placeholder="Ex. 50"
                required
              />
            </label>

            <button type="submit" className={styles.submit} disabled={recharging}>
              {recharging ? "Ajout…" : "Recharger"}
            </button>
          </form>

          {rechMsg && <p role="status">{rechMsg}</p>}
          {rechError && (
            <p className={styles.error} role="alert">
              {rechError}
            </p>
          )}
        </section>
      )}

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <h2>Déclarer un compteur</h2>
        </div>

        <form className={styles.form} onSubmit={onCreer}>
          <label className={styles.field}>
            <span>Nom</span>
            <input
              value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
              placeholder="Ex. Toiture solaire"
              required
            />
          </label>

          <label className={styles.field}>
            <span>Type</span>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <option value="production">Production</option>
              <option value="consommation">Consommation</option>
            </select>
          </label>

          {form.type === "production" && (
            <>
              <label className={styles.field}>
                <span>Source</span>
                <select
                  value={form.source}
                  onChange={(e) => setForm({ ...form, source: e.target.value })}
                >
                  {Object.entries(LIBELLES_SOURCE).map(([valeur, libelle]) => (
                    <option key={valeur} value={valeur}>
                      {libelle}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.field}>
                <span>Puissance (kWc)</span>
                <input
                  type="number"
                  min="0.1"
                  step="any"
                  value={form.puissance_kwc}
                  onChange={(e) => setForm({ ...form, puissance_kwc: e.target.value })}
                  placeholder="Ex. 5"
                  required
                />
              </label>
            </>
          )}

          <button type="submit" className={styles.submit} disabled={saving}>
            {saving ? "Enregistrement…" : "Ajouter le compteur"}
          </button>
        </form>

        {formError && <p className={styles.error} role="alert">{formError}</p>}
      </section>
    </main>
  );
}