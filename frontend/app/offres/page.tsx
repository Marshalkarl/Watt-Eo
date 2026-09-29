"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { api, messageFromError } from "@/lib/api";
import type { Offre } from "@/lib/types";
import Image from "next/image";

const OffresMap = dynamic(() => import("@/components/OffresMap"), {
  ssr: false,
  loading: () => (
    <div className="offres-map-loading">
      <span className="offres-spinner" aria-hidden="true" />
      <span>Chargement de la carte…</span>
    </div>
  ),
});

function OffreCard({
  offre,
  role,
  selected,
  onSelect,
  onAcheter,
}: {
  offre: Offre;
  role: "producteur" | "consommateur" | null;
  selected: boolean;
  onSelect: (id: number) => void;
  onAcheter: (offre: Offre, quantite: number) => Promise<void>;
}) {
  const [quantite, setQuantite] = useState("1");
  const [busy, setBusy] = useState(false);

  const q = Number(quantite);
  const valide = Number.isFinite(q) && q > 0 && q <= offre.quantite_kwh;
  const total = valide
    ? Math.round(q * offre.prix_kwh * 100) / 100
    : 0;

  async function handleAcheter() {
    if (!valide || busy) return;

    setBusy(true);
    try {
      await onAcheter(offre, q);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article
      id={`offre-${offre.id}`}
      className={`offre-card${selected ? " offre-card-selected" : ""}`}
    >
      <div className="offre-card-top">
        <div className="offre-avatar" aria-hidden="true">
          {(offre.producteur?.name ?? "P").charAt(0).toUpperCase()}
        </div>
        <div className="offre-producer">
          <span className="offre-producer-label">PRODUCTEUR</span>
          <h3>{offre.producteur?.name ?? "Producteur"}</h3>
        </div>
        {selected && <span className="offre-selected-tag">Sur la carte</span>}
      </div>

      <div className="offre-details">
        <div className="offre-detail">
          <span className="offre-detail-icon" aria-hidden="true">⚡</span>
          <div>
            <small>Disponible</small>
            <strong>{offre.quantite_kwh} kWh</strong>
          </div>
        </div>

        <div className="offre-detail">
          <span className="offre-detail-icon offre-price-icon" aria-hidden="true">
            ◈
          </span>
          <div>
            <small>Prix par kWh</small>
            <strong>{offre.prix_kwh} crédits</strong>
          </div>
        </div>

        {offre.distance_km !== undefined && (
          <div className="offre-distance">
            <span aria-hidden="true">⌖</span>
            {offre.distance_km.toFixed(1)} km de vous
          </div>
        )}
      </div>

      <button
        type="button"
        className="offre-map-button"
        onClick={() => onSelect(offre.id)}
      >
        <span aria-hidden="true">⌖</span>
        Voir sur la carte
      </button>

      {role === "consommateur" ? (
        <div className="offre-buy">
          <label htmlFor={`quantite-${offre.id}`}>Quantité à acheter</label>
          <div className="offre-buy-row">
            <div className="offre-quantity-input">
              <input
                id={`quantite-${offre.id}`}
                type="number"
                min="0.1"
                step="0.1"
                max={offre.quantite_kwh}
                value={quantite}
                onChange={(event) => setQuantite(event.target.value)}
              />
              <span>kWh</span>
            </div>
            <span className="offre-buy-total">
              {total.toFixed(2)} crédits
            </span>
          </div>

          <button
            type="button"
            className="offre-buy-button"
            disabled={!valide || busy}
            onClick={handleAcheter}
          >
            {busy ? "Achat en cours…" : "Acheter cette offre"}
            {!busy && <span aria-hidden="true">→</span>}
          </button>
        </div>
      ) : role === "producteur" ? (
        <p className="offre-role-hint">
          Les achats sont réservés aux consommateurs.
        </p>
      ) : (
        <p className="offre-role-hint">
          <Link href="/login">Connectez-vous</Link> pour acheter cette offre.
        </p>
      )}
    </article>
  );
}

export default function OffresPage() {
  const { user, token, loading: authLoading, refreshUser } = useAuth();

  const [offres, setOffres] = useState<Offre[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [rayon, setRayon] = useState("10");
  const [geoLoading, setGeoLoading] = useState(false);

  const charger = useCallback(async () => {
    const params = new URLSearchParams();

    if (position) {
      params.set("latitude", String(position.lat));
      params.set("longitude", String(position.lng));
      if (rayon) params.set("rayon", rayon);
    }

    const query = params.toString();

    try {
      setError("");
      const result = await api<Offre[]>(`/offres${query ? `?${query}` : ""}`);
      setOffres(result);
    } catch (err) {
      setError(messageFromError(err));
    } finally {
      setLoading(false);
    }
  }, [position, rayon]);

  useEffect(() => {
    setLoading(true);
    void charger();
  }, [charger]);

  function autourDeMoi() {
    setError("");

    if (!navigator.geolocation) {
      setError("La géolocalisation n’est pas disponible sur cet appareil.");
      return;
    }

    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (result) => {
        setPosition({
          lat: result.coords.latitude,
          lng: result.coords.longitude,
        });
        setGeoLoading(false);
      },
      () => {
        setError("Position refusée ou indisponible.");
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function choisir(id: number) {
    setSelectedId(id);
    document
      .getElementById(`offre-${id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function acheter(offre: Offre, quantite: number) {
    setMessage("");
    setError("");

    try {
      await api(`/offres/${offre.id}/acheter`, {
        method: "POST",
        token,
        body: { quantite_kwh: quantite },
      });

      setMessage(`Achat confirmé : ${quantite} kWh.`);
      await Promise.all([charger(), refreshUser()]);
    } catch (err) {
      setError(messageFromError(err));
    }
  }

  return (
    <main className="offres-page">
      <header className="offres-topbar">
        
 <Link
          href="/dashboard"
          className="home-brand"
          aria-label="AfriWatt, accueil"
          
        >
          <img
            src="/images/afriwatt-logo.png"
            alt="AfriWatt"
            className="home-brand-logo"
          />
        </Link>
        <nav className="offres-nav" aria-label="Navigation principale">
          <Link href="/dashboard">Tableau de bord</Link>
          <Link href="/transactions">Mes transactions</Link>
          {user && (
            <span className="offres-credits">
              <span aria-hidden="true">◈</span>
              {user.credits} crédits
            </span>
          )}
        </nav>
      </header>

      <div className="offres-content">
        <section className="offres-heading">
          <div>
            <span className="offres-eyebrow">ÉNERGIE LOCALE</span>
            <h1>Trouvez votre énergie.</h1>
            <p>
              Découvrez les offres disponibles et achetez de l’énergie
              renouvelable près de chez vous.
            </p>
          </div>

          <div className="offres-heading-icon" aria-hidden="true">
            ☀️
          </div>
        </section>

        <section className="offres-toolbar" aria-label="Filtres des offres">
          <div className="offres-toolbar-copy">
            <strong>Explorer les offres</strong>
            <span>
              {position
                ? `Recherche autour de votre position${rayon ? ` · ${rayon} km` : " · sans limite"}`
                : "Toutes les offres disponibles"}
            </span>
          </div>

          <div className="offres-filters">
            <button
              type="button"
              className="offres-location-button"
              onClick={autourDeMoi}
              disabled={geoLoading}
            >
              <span aria-hidden="true">⌖</span>
              {geoLoading ? "Localisation…" : "Autour de moi"}
            </button>

            {position && (
              <>
                <select
                  aria-label="Rayon de recherche"
                  value={rayon}
                  onChange={(event) => setRayon(event.target.value)}
                >
                  <option value="5">5 km</option>
                  <option value="10">10 km</option>
                  <option value="25">25 km</option>
                  <option value="50">50 km</option>
                  <option value="">Sans limite</option>
                </select>

                <button
                  type="button"
                  className="offres-reset-button"
                  onClick={() => setPosition(null)}
                >
                  Tout afficher
                </button>
              </>
            )}
          </div>
        </section>

        {message && (
          <div className="offres-notice offres-notice-success" role="status">
            <span aria-hidden="true">✓</span>
            {message}
          </div>
        )}

        {error && (
          <div className="offres-notice offres-notice-error" role="alert">
            <span aria-hidden="true">!</span>
            {error}
          </div>
        )}

        <section className="offres-map-section">
          <div className="offres-section-heading">
            <div>
              <h2>Carte des offres</h2>
              <p>Choisissez un repère pour afficher l’offre correspondante.</p>
            </div>
          </div>

          <div className="offres-map-frame">
            <OffresMap
              offres={offres}
              selectedId={selectedId}
              onSelect={choisir}
              position={position}
            />
          </div>
        </section>

        <section className="offres-list-section">
          <div className="offres-section-heading">
            <div>
              <h2>Offres disponibles</h2>
              <p>
                {loading || authLoading
                  ? "Chargement des offres…"
                  : `${offres.length} offre${offres.length === 1 ? "" : "s"} trouvée${offres.length === 1 ? "" : "s"}`}
              </p>
            </div>
          </div>

          {loading || authLoading ? (
            <div className="offres-state">
              <span className="offres-spinner" aria-hidden="true" />
              <p>Chargement des offres…</p>
            </div>
          ) : offres.length === 0 ? (
            <div className="offres-empty">
              <span className="offres-empty-icon" aria-hidden="true">⚡</span>
              <h3>Aucune offre pour le moment</h3>
              <p>
                {position
                  ? "Aucune offre n’a été trouvée dans cette zone. Essayez d’élargir le rayon."
                  : "Revenez bientôt pour découvrir les prochaines offres d’énergie."}
              </p>
              {position && (
                <button
                  type="button"
                  className="offres-reset-button"
                  onClick={() => setPosition(null)}
                >
                  Afficher toutes les offres
                </button>
              )}
            </div>
          ) : (
            <div className="offres-grid">
              {offres.map((offre) => (
                <OffreCard
                  key={offre.id}
                  offre={offre}
                  role={user?.role ?? null}
                  selected={offre.id === selectedId}
                  onSelect={choisir}
                  onAcheter={acheter}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}