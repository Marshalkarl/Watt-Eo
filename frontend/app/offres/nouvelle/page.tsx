"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { api, messageFromError } from "@/lib/api";
import type { RepereMarche } from "@/lib/types";
import { SOURCES } from "@/lib/sources";

export default function NouvelleOffrePage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState({
    quantite_kwh: "",
    prix_kwh: "",
    source: "solaire",
    latitude: "",
    longitude: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [positionBusy, setPositionBusy] = useState(false);
  const [repere, setRepere] = useState<RepereMarche | null>(null);

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

    setForm((current) => {
      if (current.latitude || current.longitude) return current;

      return {
        ...current,
        latitude: user.latitude != null ? String(user.latitude) : "",
        longitude: user.longitude != null ? String(user.longitude) : "",
      };
    });
       }, [loading, user, router]);
    // Quantité préremplie depuis la page « Mon installation » (?quantite=227.2)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("quantite");
    if (q && Number.isFinite(Number(q)) && Number(q) > 0) {
      setForm((current) =>
        current.quantite_kwh ? current : { ...current, quantite_kwh: q },
        );
       }
     }  , []);

  useEffect(() => {
  api("/marche/prix", { token })
    .then((data) => {
      console.log("repères marché :", data);
      const r = data as RepereMarche;
      setRepere(r);
      setForm((c) => (c.prix_kwh ? c : { ...c, prix_kwh: String(r.prix_suggere) }));
    })
    .catch((err) => console.error("échec /marche/prix :", err));
      }, [token]);

  function setField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function useMyPosition() {
    setError("");

    if (!navigator.geolocation) {
      setError("La géolocalisation n’est pas disponible sur cet appareil.");
      return;
    }

    setPositionBusy(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setField("latitude", position.coords.latitude.toFixed(6));
        setField("longitude", position.coords.longitude.toFixed(6));
        setPositionBusy(false);
      },
      () => {
        setError("Position refusée ou indisponible. Vous pouvez la saisir manuellement.");
        setPositionBusy(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const quantite = Number(form.quantite_kwh);
    const prix = Number(form.prix_kwh);
    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);

    if (
      !Number.isFinite(quantite) ||
      !Number.isFinite(prix) ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      setError("Vérifiez les valeurs saisies avant de publier.");
      return;
    }

    setBusy(true);

    try {
      await api("/offres", {
        method: "POST",
        token,
        body: {
          quantite_kwh: quantite,
          prix_kwh: prix,
          source: form.source,
          latitude,
          longitude,
        },
      });

      router.push("/mes-offres");
    } catch (err) {
      setError(messageFromError(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) {
    return (
      <main className="nouvelle-offre-loading">
        <span className="nouvelle-offre-spinner" aria-hidden="true" />
        <p>Préparation de votre espace…</p>
      </main>
    );
  }

  return (
    <main className="nouvelle-offre-page">
      <header className="nouvelle-offre-topbar">
        <Link href="/dashboard" className="nouvelle-offre-brand">
          <span className="nouvelle-offre-brand-mark">A</span>
          <span>Watt-Eo</span>
        </Link>

        <Link href="/mes-offres" className="nouvelle-offre-back">
          <span aria-hidden="true">←</span>
          Mes offres
        </Link>
      </header>

      <div className="nouvelle-offre-layout">
        <aside className="nouvelle-offre-intro">
          <span className="nouvelle-offre-kicker">ESPACE PRODUCTEUR</span>
          <h1>Partagez votre énergie avec votre communauté.</h1>
          <p>
            Publiez votre surplus d’énergie renouvelable et rendez-le accessible
            aux consommateurs près de chez vous.
          </p>

          <div className="nouvelle-offre-tip">
            <span className="nouvelle-offre-tip-icon" aria-hidden="true">
              ☀️
            </span>
            <div>
              <strong>Un geste qui compte</strong>
              <p>
                Chaque offre contribue à une énergie plus locale et plus
                durable.
              </p>
            </div>
          </div>
        </aside>

        <section className="nouvelle-offre-panel">
          <div className="nouvelle-offre-panel-heading">
            <span className="nouvelle-offre-step">NOUVELLE ANNONCE</span>
            <h2>Publier une offre</h2>
            <p>Renseignez les informations de l’énergie que vous proposez.</p>
          </div>

          <form onSubmit={onSubmit}>
            <div className="nouvelle-offre-fields">
              <label className="nouvelle-offre-field">
                <span>Quantité disponible</span>
                <div className="nouvelle-offre-input-wrap">
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    placeholder="Ex. 25"
                    value={form.quantite_kwh}
                    onChange={(event) =>
                      setField("quantite_kwh", event.target.value)
                    }
                    required
                  />
                  <span className="nouvelle-offre-unit">kWh</span>
                </div>
                <small>Indiquez la quantité d’énergie disponible à la vente.</small>
              </label>

              <label className="nouvelle-offre-field">
                <span>Prix de vente</span>
                <div className="nouvelle-offre-input-wrap">
                 <input
                     type="number"
                     min={repere?.prix_plancher_kwh ?? 0.1}
                     max={repere?.prix_plafond_kwh}
                      step="0.1"
                       placeholder={repere ? `Ex. ${repere.prix_suggere}` : "Ex. 100"}
                     value={form.prix_kwh}
                     onChange={(event) => setField("prix_kwh", event.target.value)}
                     required
                    />
                  <span className="nouvelle-offre-unit">crédits/kWh</span>
                </div>
                <small>
                   {repere
                       ? `Entre ${repere.prix_plancher_kwh} et ${repere.prix_plafond_kwh} crédits/kWh. Prix suggéré : ${repere.prix_suggere}.` +
                         (repere.prix_moyen !== null && repere.economie_pct !== null
                        ? ` Moyenne du marché : ${repere.prix_moyen} (${repere.economie_pct} % sous le réseau).`
                          : "")
                       : "Prix demandé pour chaque kilowattheure."}
                  </small>
              </label>

              <label className="nouvelle-offre-field">
                    <span>Source d’énergie</span>
                    <div className="nouvelle-offre-input-wrap">
                <select
                       value={form.source}
                        onChange={(event) => setField("source", event.target.value)}
                 >
                          {SOURCES.map((s) => (
                           <option key={s.value} value={s.value}>
                            {s.icon} {s.label}
                          </option>
                         ))}
                      </select>
                        </div>
                     <small>D’où vient l’énergie que vous vendez.</small>
               </label>
            </div>

            <div className="nouvelle-offre-location-heading">
              <div>
                <h3>Emplacement de l’offre</h3>
                <p>Permet aux acheteurs de trouver l’énergie près de chez eux.</p>
              </div>
              <span aria-hidden="true">⌖</span>
            </div>

            <div className="nouvelle-offre-fields nouvelle-offre-coordinates">
              <label className="nouvelle-offre-field">
                <span>Latitude</span>
                <input
                  type="number"
                  step="any"
                  placeholder="Ex. 5.3600"
                  value={form.latitude}
                  onChange={(event) =>
                    setField("latitude", event.target.value)
                  }
                  required
                />
              </label>

              <label className="nouvelle-offre-field">
                <span>Longitude</span>
                <input
                  type="number"
                  step="any"
                  placeholder="Ex. -4.0083"
                  value={form.longitude}
                  onChange={(event) =>
                    setField("longitude", event.target.value)
                  }
                  required
                />
              </label>
            </div>

            <button
              type="button"
              className="nouvelle-offre-geolocation"
              onClick={useMyPosition}
              disabled={positionBusy}
            >
              <span aria-hidden="true">◎</span>
              {positionBusy
                ? "Localisation en cours…"
                : "Utiliser ma position actuelle"}
            </button>

            {error && (
              <p className="nouvelle-offre-error" role="alert">
                <span aria-hidden="true">!</span>
                {error}
              </p>
            )}

            <button
              type="submit"
              className="nouvelle-offre-submit"
              disabled={busy}
            >
              {busy ? "Publication en cours…" : "Publier mon offre"}
              {!busy && <span aria-hidden="true">→</span>}
            </button>

            <p className="nouvelle-offre-privacy">
              Vous pourrez gérer ou masquer votre offre depuis votre espace.
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}

