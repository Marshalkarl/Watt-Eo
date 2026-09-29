"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { messageFromError } from "@/lib/api";

type Role = "producteur" | "consommateur";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    password_confirmation: "",
    role: "consommateur" as Role,
    latitude: "",
    longitude: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [positionBusy, setPositionBusy] = useState(false);

  const set = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  function useMyPosition() {
    setError("");

    if (!navigator.geolocation) {
      setError("La géolocalisation n’est pas disponible sur cet appareil.");
      return;
    }

    setPositionBusy(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        set("latitude", position.coords.latitude.toFixed(6));
        set("longitude", position.coords.longitude.toFixed(6));
        setPositionBusy(false);
      },
      () => {
        setError("Position refusée ou indisponible.");
        setPositionBusy(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (form.password !== form.password_confirmation) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setBusy(true);

    try {
      await register({
        name: form.name,
        email: form.email,
        password: form.password,
        password_confirmation: form.password_confirmation,
        role: form.role,
        latitude: form.latitude ? Number(form.latitude) : undefined,
        longitude: form.longitude ? Number(form.longitude) : undefined,
      });

      router.push("/dashboard");
    } catch (err) {
      setError(messageFromError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="register-page">
      <header className="register-header">
        <Link href="/" className="register-brand" aria-label="Énergie P2P, accueil">
          <span className="register-brand-icon" aria-hidden="true">
            ⚡
          </span>
          <span>Énergie P2P</span>
        </Link>

        <Link href="/" className="register-back-link">
          Retour à l’accueil
        </Link>
      </header>

      <section className="register-layout">
        <aside className="register-intro">
          <div className="register-intro-content">
            <span className="register-kicker">
              <span className="register-kicker-dot" />
              Rejoignez le mouvement
            </span>

            <h1>
              L’énergie locale
              <br />
              <span>commence ici.</span>
            </h1>

            <p>
              Créez votre compte pour échanger une énergie renouvelable,
              directement entre voisins.
            </p>

            <div className="register-benefits">
              <div className="register-benefit">
                <span className="register-benefit-icon" aria-hidden="true">
                  ☀️
                </span>
                <div>
                  <strong>Une énergie plus proche</strong>
                  <span>Découvrez les producteurs autour de vous.</span>
                </div>
              </div>

              <div className="register-benefit">
                <span className="register-benefit-icon" aria-hidden="true">
                  🌱
                </span>
                <div>
                  <strong>Un impact positif</strong>
                  <span>Participez à une transition plus responsable.</span>
                </div>
              </div>
            </div>
          </div>

          <div className="register-aside-footer">
            <span aria-hidden="true">✳</span>
            Une communauté, une énergie partagée.
          </div>
        </aside>

        <div className="register-form-side">
          <form className="register-form" onSubmit={onSubmit}>
            <div className="register-form-heading">
              <span className="register-form-step">INSCRIPTION</span>
              <h2>Créer votre compte</h2>
              <p>Quelques informations suffisent pour commencer.</p>
            </div>

            <div className="register-fields">
              <label className="register-field">
                <span>Nom complet</span>
                <input
                  type="text"
                  autoComplete="name"
                  placeholder="Ex. Camille Martin"
                  value={form.name}
                  onChange={(event) => set("name", event.target.value)}
                  required
                />
              </label>

              <label className="register-field">
                <span>Adresse e-mail</span>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="vous@exemple.fr"
                  value={form.email}
                  onChange={(event) => set("email", event.target.value)}
                  required
                />
              </label>

              <div className="register-field-row">
                <label className="register-field">
                  <span>Mot de passe</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    placeholder="8 caractères minimum"
                    minLength={8}
                    value={form.password}
                    onChange={(event) => set("password", event.target.value)}
                    required
                  />
                </label>

                <label className="register-field">
                  <span>Confirmation</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    placeholder="Répétez le mot de passe"
                    minLength={8}
                    value={form.password_confirmation}
                    onChange={(event) =>
                      set("password_confirmation", event.target.value)
                    }
                    required
                  />
                </label>
              </div>
            </div>

            <fieldset className="register-role">
              <legend>Comment souhaitez-vous participer ?</legend>

              <label
                className={`register-role-option ${
                  form.role === "consommateur" ? "is-selected" : ""
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value="consommateur"
                  checked={form.role === "consommateur"}
                  onChange={() => set("role", "consommateur")}
                />
                <span className="register-role-icon" aria-hidden="true">
                  🏠
                </span>
                <span className="register-role-copy">
                  <strong>Consommateur</strong>
                  <small>J’achète de l’énergie locale</small>
                </span>
                <span className="register-radio" aria-hidden="true" />
              </label>

              <label
                className={`register-role-option ${
                  form.role === "producteur" ? "is-selected" : ""
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value="producteur"
                  checked={form.role === "producteur"}
                  onChange={() => set("role", "producteur")}
                />
                <span className="register-role-icon" aria-hidden="true">
                  ☀️
                </span>
                <span className="register-role-copy">
                  <strong>Producteur</strong>
                  <small>Je partage mon surplus d’énergie</small>
                </span>
                <span className="register-radio" aria-hidden="true" />
              </label>
            </fieldset>

            <div className="register-location">
              <div className="register-location-heading">
                <div>
                  <strong>Votre localisation</strong>
                  <span>Facultative — pour trouver les offres proches.</span>
                </div>

                <button
                  type="button"
                  className="register-location-button"
                  onClick={useMyPosition}
                  disabled={positionBusy}
                >
                  {positionBusy ? "Localisation..." : "Me localiser"}
                </button>
              </div>

              <div className="register-field-row">
                <label className="register-field">
                  <span>Latitude</span>
                  <input
                    inputMode="decimal"
                    placeholder="Ex. 48.856614"
                    value={form.latitude}
                    onChange={(event) => set("latitude", event.target.value)}
                  />
                </label>

                <label className="register-field">
                  <span>Longitude</span>
                  <input
                    inputMode="decimal"
                    placeholder="Ex. 2.352222"
                    value={form.longitude}
                    onChange={(event) => set("longitude", event.target.value)}
                  />
                </label>
              </div>
            </div>

            {error && (
              <p className="register-error" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="register-submit"
              disabled={busy}
            >
              {busy ? "Création du compte..." : "Créer mon compte"}
              {!busy && <span aria-hidden="true">→</span>}
            </button>

            <p className="register-login">
              Déjà inscrit ? <Link href="/login">Se connecter</Link>
            </p>

            <p className="register-terms">
              En créant un compte, vous rejoignez une communauté engagée pour
              une énergie plus locale.
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}