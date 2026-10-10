"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { api, messageFromError } from "@/lib/api";
import type { Offre } from "@/lib/types";
import { SOURCES, labelSource, iconSource } from "@/lib/sources";
import AchatReussi from "@/components/AchatReussi";
import NombreAnime from "@/components/NombreAnime";

const OffresMap = dynamic(() => import("@/components/OffresMap"), {
  ssr: false,
  loading: () => (
    <div className="offres-map-loading">
      <span className="offres-spinner" aria-hidden="true" />
      <span>Chargement de la carte…</span>
    </div>
  ),
});

type AchatSucces = {
  producteur: string;
  kwh: number;
  total: number;
};

// Évite un appel au serveur à chaque touche tapée dans les filtres.
function useDebounced<T>(value: T, delay = 400) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

function OffreCard({
  offre,
  role,
  selected,
  onSelect,
  onAcheter,
}: {
  offre: Offre;
  role: "producteur" | "consommateur" | "admin" | null;
  selected: boolean;
  onSelect: (id: number) => void;
  onAcheter: (offre: Offre, quantite: number) => Promise<void>;
}) {
  const [quantite, setQuantite] = useState("1");
  const [busy, setBusy] = useState(false);

  const q = Number(quantite);
  const disponible = Number(offre.quantite_kwh);
  const prix = Number(offre.prix_kwh);
  const valide = Number.isFinite(q) && q > 0 && q <= disponible;
  const total = valide ? Math.round(q * prix * 100) / 100 : 0;

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

        <div className="offre-detail">
          <span className="offre-detail-icon" aria-hidden="true">
            {iconSource(offre.source)}
          </span>
          <div>
            <small>Source</small>
            <strong>{labelSource(offre.source)}</strong>
          </div>
        </div>

        {offre.distance_km != null && (
          <div className="offre-distance">
            <span aria-hidden="true">⌖</span>
            {Number(offre.distance_km).toFixed(1)} km de vous
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
                max={disponible}
                value={quantite}
                onChange={(event) => setQuantite(event.target.value)}
              />
              <span>kWh</span>
            </div>
            <span className="offre-buy-total">{total.toFixed(2)} crédits</span>
          </div>

          <button
            type="button"
            className={`offre-buy-button${busy ? " is-loading" : ""}`}
            aria-busy={busy}
            disabled={!valide || busy}
            onClick={handleAcheter}
          >
            {busy ? "Achat en cours…" : "Acheter cette offre"}
            {!busy && <span aria-hidden="true">→</span>}
          </button>
        </div>
      ) : role === "producteur" || role === "admin" ? (
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
  const [succes, setSucces] = useState<AchatSucces | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [rayon, setRayon] = useState("10");
  const [geoLoading, setGeoLoading] = useState(false);

  // Filtres et tri
  const [prixMax, setPrixMax] = useState("");
  const [quantiteMin, setQuantiteMin] = useState("");
  const [tri, setTri] = useState("");
  const [source, setSource] = useState("");
  const prixMaxD = useDebounced(prixMax);
  const quantiteMinD = useDebounced(quantiteMin);
  const filtresActifs = Boolean(prixMax || quantiteMin || tri || source);

  const estAdmin = user?.role === "admin";

  // Numéro de la dernière requête : ignore les réponses arrivées en retard.
  const requeteRef = useRef(0);

  // Petite pulsation des crédits quand leur valeur change.
  const credits = user ? Number(user.credits) : null;
  const creditsPrecedents = useRef<number | null>(null);
  const [creditsBump, setCreditsBump] = useState(false);

  useEffect(() => {
    if (credits === null) return;

    const precedent = creditsPrecedents.current;
    creditsPrecedents.current = credits;

    if (precedent !== null && precedent !== credits) {
      setCreditsBump(true);
      const timer = setTimeout(() => setCreditsBump(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [credits]);

  const fermerSucces = useCallback(() => setSucces(null), []);

  function reinitialiserFiltres() {
    setPrixMax("");
    setQuantiteMin("");
    setTri("");
    setSource("");
  }

  function toutReinitialiser() {
    setPosition(null);
    reinitialiserFiltres();
  }

  const charger = useCallback(async () => {
    const requete = ++requeteRef.current;
    const params = new URLSearchParams();

    if (position) {
      params.set("latitude", String(position.lat));
      params.set("longitude", String(position.lng));
      if (rayon) params.set("rayon", rayon);
    }
    if (prixMaxD) params.set("prix_max", prixMaxD);
    if (quantiteMinD) params.set("quantite_min", quantiteMinD);
    if (tri) params.set("tri", tri);
    if (source) params.set("source", source);

    const query = params.toString();

    try {
      const result = await api<Offre[]>(`/offres${query ? `?${query}` : ""}`);
      if (requete !== requeteRef.current) return;
      setError("");
      setOffres(result);
    } catch (err) {
      if (requete !== requeteRef.current) return;
      setError(messageFromError(err));
    } finally {
      if (requete === requeteRef.current) setLoading(false);
    }
  }, [position, rayon, prixMaxD, quantiteMinD, tri, source]);

  useEffect(() => {
    void charger();
  }, [charger]);

  // Sans position, le tri « distance » n'a plus de sens.
  useEffect(() => {
    if (!position && tri === "distance") setTri("");
  }, [position, tri]);

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
    setSucces(null);
    setError("");

    try {
      await api(`/offres/${offre.id}/acheter`, {
        method: "POST",
        token,
        body: { quantite_kwh: quantite },
      });
    } catch (err) {
      setError(messageFromError(err));
      return;
    }

    // L'achat a réussi : on célèbre tout de suite, puis on rafraîchit.
    setSucces({
      producteur: offre.producteur?.name ?? "le producteur",
      kwh: quantite,
      total: Math.round(quantite * Number(offre.prix_kwh) * 100) / 100,
    });

    try {
      await Promise.all([charger(), refreshUser()]);
    } catch {
      // L'achat est déjà enregistré ; un échec de rafraîchissement n'est pas bloquant.
    }
  }

  return (
    <main className="offres-page">
      <header className="offres-topbar">
        <Link
          href={estAdmin ? "/admin" : "/dashboard"}
          className="home-brand"
          aria-label="Watt-Eo, accueil"
        >
          <img
            src="/images/Watt-Eo-logo.png"
            alt="Watt-Eo"
            className="home-brand-logo"
          />
        </Link>

        <nav className="offres-nav" aria-label="Navigation principale">
          {estAdmin ? (
            <Link href="/admin">Administration</Link>
          ) : (
            <>
              <Link href="/dashboard">Tableau de bord</Link>
              <Link href="/transactions">Mes transactions</Link>
            </>
          )}
          {user?.role === "producteur" && (
            <Link href="/installation">Mon installation</Link>
          )}
          {user && !estAdmin && credits !== null && (
            <span className={`offres-credits${creditsBump ? " credits-bump" : ""}`}>
              <span aria-hidden="true">◈</span>
              <NombreAnime valeur={credits} decimales={2} /> crédits
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

        <section
          className="offres-toolbar offres-toolbar-extra"
          aria-label="Prix, quantité, source et tri"
        >
          <div className="offres-field">
            <label htmlFor="filtre-prix">Prix maximum</label>
            <div className="offres-field-input">
              <input
                id="filtre-prix"
                type="number"
                min="0"
                step="1"
                placeholder="Ex. 100"
                value={prixMax}
                onChange={(event) => setPrixMax(event.target.value)}
              />
              <span>crédits/kWh</span>
            </div>
          </div>

          <div className="offres-field">
            <label htmlFor="filtre-quantite">Quantité minimale</label>
            <div className="offres-field-input">
              <input
                id="filtre-quantite"
                type="number"
                min="0"
                step="1"
                placeholder="Ex. 20"
                value={quantiteMin}
                onChange={(event) => setQuantiteMin(event.target.value)}
              />
              <span>kWh</span>
            </div>
          </div>

          <div className="offres-field">
            <label htmlFor="filtre-source">Source d’énergie</label>
            <select
              id="filtre-source"
              value={source}
              onChange={(event) => setSource(event.target.value)}
            >
              <option value="">Toutes les sources</option>
              {SOURCES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.icon} {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="offres-field">
            <label htmlFor="tri-offres">Trier par</label>
            <select
              id="tri-offres"
              value={tri}
              onChange={(event) => setTri(event.target.value)}
            >
              <option value="">Par défaut</option>
              <option value="prix_asc">Prix croissant</option>
              <option value="prix_desc">Prix décroissant</option>
              <option value="quantite_desc">Quantité disponible</option>
              <option value="distance" disabled={!position}>
                Distance {position ? "" : "(activez « Autour de moi »)"}
              </option>
            </select>
          </div>

          {filtresActifs && (
            <button
              type="button"
              className="offres-reset-button"
              onClick={reinitialiserFiltres}
            >
              Réinitialiser
            </button>
          )}
        </section>

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
                {position || filtresActifs
                  ? "Aucune offre ne correspond à vos critères. Essayez d’élargir le rayon ou de retirer des filtres."
                  : "Revenez bientôt pour découvrir les prochaines offres d’énergie."}
              </p>
              {(position || filtresActifs) && (
                <button
                  type="button"
                  className="offres-reset-button"
                  onClick={toutReinitialiser}
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

      <AchatReussi
        open={succes !== null}
        onClose={fermerSucces}
        message={
          succes
            ? `Votre commande auprès de ${succes.producteur} a bien été enregistrée.`
            : undefined
        }
        details={
          succes
            ? [
                { label: "Énergie", valeur: `${succes.kwh} kWh` },
                { label: "Total", valeur: `${succes.total.toFixed(2)} crédits` },
              ]
            : []
        }
      />
    </main>
  );
}