"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

const steps = [
  {
    number: "01",
    icon: "☀️",
    title: "Le producteur publie",
    description:
      "Il indique la quantité d’énergie disponible, son prix et sa localisation.",
  },
  {
    number: "02",
    icon: "⚡",
    title: "Le consommateur choisit",
    description:
      "Il découvre les offres à proximité et achète l’énergie dont il a besoin.",
  },
  {
    number: "03",
    icon: "🌱",
    title: "Chacun suit son impact",
    description:
      "Le tableau de bord permet de suivre l’énergie échangée et le CO₂ évité.",
  },
];

export default function HomePage() {
  const { user, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <main className="home-page">
      <header className="home-container home-header">
        <Link
          href="/"
          className="home-brand"
          aria-label="AfriWatt, accueil"
          onClick={closeMenu}
        >
          <img
            src="/images/afriwatt-logo.png"
            alt="AfriWatt"
            className="home-brand-logo"
          />
        </Link>

        <button
          type="button"
          className={`home-menu-toggle ${menuOpen ? "is-open" : ""}`}
          aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={menuOpen}
          aria-controls="home-menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>

        <div
          id="home-menu"
          className={`home-menu-panel ${menuOpen ? "is-open" : ""}`}
        >
          <nav className="home-nav" aria-label="Navigation principale">
            <Link href="/#fonctionnement" onClick={closeMenu}>
              Comment ça marche
            </Link>
            <Link href="/offres" onClick={closeMenu}>
              Les offres
            </Link>
          </nav>

          <div className="home-header-actions">
            {!loading &&
              (user ? (
                <Link
                  href="/dashboard"
                  className="home-button home-button-dark"
                  onClick={closeMenu}
                >
                  Mon espace
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="home-login-link"
                    onClick={closeMenu}
                  >
                    Connexion
                  </Link>
                  <Link
                    href="/register"
                    className="home-button home-button-dark"
                    onClick={closeMenu}
                  >
                    Créer un compte
                  </Link>
                </>
              ))}
          </div>
        </div>
      </header>

      <section className="home-container home-hero">
        <div className="home-hero-copy">
          <div className="home-eyebrow">
            <span className="home-status-dot" />
            L’énergie locale, autrement
          </div>

          <h1>
            L’énergie du soleil,
            <span> partagée entre voisins.</span>
          </h1>

          <p className="home-description">
            Connectez les producteurs d’énergie renouvelable aux habitants de
            leur quartier. Une énergie plus proche, plus humaine et plus durable.
          </p>

          <div className="home-hero-actions">
            <Link href="/offres" className="home-button home-button-dark">
              Découvrir les offres <span aria-hidden="true">→</span>
            </Link>

            {!loading &&
              (user ? (
                <Link
                  href="/dashboard"
                  className="home-button home-button-outline"
                >
                  Mon tableau de bord
                </Link>
              ) : (
                <Link
                  href="/register"
                  className="home-button home-button-outline"
                >
                  Rejoindre la communauté
                </Link>
              ))}
          </div>

          <div className="home-community">
            <div className="home-avatars" aria-hidden="true">
              <span>👩🏻</span>
              <span>👨🏽</span>
              <span>👩🏾</span>
            </div>
            <p>
              <strong>Une communauté engagée</strong>
              <br />
              pour une énergie plus responsable
            </p>
          </div>
        </div>

        <div className="home-hero-visual">
          <div className="home-visual-card">
            <div className="home-visual-background">
              <div className="home-visual-heading">
                <div>
                  <p>Votre énergie, près de chez vous</p>
                  <h2>Le réseau local</h2>
                </div>
                <span className="home-location-icon" aria-hidden="true">
                  📍
                </span>
              </div>

              <div className="home-energy-illustration" aria-hidden="true">
                <span className="home-map-point point-one" />
                <span className="home-map-point point-two" />
                <span className="home-map-point point-three" />
                <span className="home-sun">☀️</span>
              </div>

              <div className="home-offer-preview">
                <span className="home-offer-icon" aria-hidden="true">
                  ⚡
                </span>
                <div className="home-offer-info">
                  <strong>Énergie disponible</strong>
                  <span>Producteur à proximité</span>
                </div>
                <div className="home-offer-amount">
                  <strong>4,8 kWh</strong>
                  <span>Énergie solaire</span>
                </div>
              </div>
            </div>
          </div>

          <div className="home-impact-card">
            <span>Impact positif</span>
            <strong>− 12 kg de CO₂</strong>
          </div>
        </div>
      </section>

      <section className="home-stats-wrap">
        <div className="home-container home-stats">
          <div>
            <strong>100 %</strong>
            <span>d’énergie renouvelable</span>
          </div>
          <div>
            <strong>À proximité</strong>
            <span>des producteurs de votre quartier</span>
          </div>
          <div>
            <strong>Ensemble</strong>
            <span>pour une transition énergétique locale</span>
          </div>
        </div>
      </section>

      <section
        id="fonctionnement"
        className="home-container home-how-it-works"
      >
        <div className="home-section-heading">
          <span>Simple comme bonjour</span>
          <h2>L’énergie locale en trois étapes</h2>
          <p>
            Passez à une consommation plus responsable grâce à l’énergie
            produite près de chez vous.
          </p>
        </div>

        <div className="home-steps">
          {steps.map((step) => (
            <article className="home-step" key={step.number}>
              <div className="home-step-top">
                <span className="home-step-icon" aria-hidden="true">
                  {step.icon}
                </span>
                <span className="home-step-number">{step.number}</span>
              </div>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="home-container home-cta">
        <span>Chaque kilowatt compte</span>
        <h2>Et si votre prochain kilowatt venait de votre voisin ?</h2>
        <p>
          Découvrez les offres disponibles autour de vous et participez à une
          énergie plus locale.
        </p>
        <Link href="/offres" className="home-button home-button-light">
          Explorer les offres <span aria-hidden="true">→</span>
        </Link>
      </section>
    </main>
  );
}