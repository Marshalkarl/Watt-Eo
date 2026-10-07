"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { messageFromError } from "@/lib/api";


export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);

    try {
      const connecte = await login(email, password);
      router.push(connecte.role === "admin" ? "/admin" : "/dashboard");
    } catch (err) {
      setError(messageFromError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      
      <div className="login-layout">
        <section className="login-intro">
          <div className="login-intro-content">
            <div className="login-kicker">
              <span className="login-kicker-dot" />
              Heureux de vous revoir
            </div>

            <h1>
              Votre espace,
              <br />
              <span>à portée de main.</span>
            </h1>

            <p>
              Connectez-vous pour retrouver votre tableau de bord et poursuivre
              votre activité en toute simplicité.
            </p>

            <div className="login-benefits">
              <div className="login-benefit">
                <span className="login-benefit-icon" aria-hidden="true">✓</span>
                <div>
                  <strong>Retrouvez vos informations</strong>
                  <span>Tout votre espace au même endroit.</span>
                </div>
              </div>

              <div className="login-benefit">
                <span className="login-benefit-icon" aria-hidden="true">↗</span>
                <div>
                  <strong>Reprenez là où vous en étiez</strong>
                  <span>Un accès simple et rapide à votre compte.</span>
                </div>
              </div>
            </div>
          </div>

          <div className="login-aside-footer">
            <span aria-hidden="true">✳</span>
            Simple, pratique et sécurisé.
          </div>
        </section>

        <section className="login-form-side">
          <form className="login-form" onSubmit={onSubmit}>
            <div className="login-form-heading">
              <span className="login-form-step">VOTRE ESPACE</span>
              <h2>Connexion</h2>
              <p>Entrez vos identifiants pour accéder à votre compte.</p>
            </div>

            <div className="login-fields">
              <label className="login-field">
                <span>Adresse email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@exemple.com"
                  autoComplete="email"
                  required
                />
              </label>

              <label className="login-field">
                <span>Mot de passe</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Votre mot de passe"
                  autoComplete="current-password"
                  required
                />
              </label>
            </div>

            {error && (
              <p className="login-error" role="alert">
                {error}
              </p>
            )}

            <button className="login-submit" type="submit" disabled={busy}>
              {busy ? "Connexion en cours..." : "Se connecter"}
              {!busy && <span aria-hidden="true">→</span>}
            </button>

            <p className="login-register">
              Pas encore de compte ?{" "}
              <Link href="/register">Créer un compte</Link>
            </p>

            <p className="login-terms">
              Vos informations restent privées et sont utilisées uniquement
              pour accéder à votre espace.
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}