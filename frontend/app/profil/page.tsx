"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { api, messageFromError } from "@/lib/api";
import NotificationBell from "@/components/NotificationBell";

export default function ProfilPage() {
  const { user, token, loading, logout, refreshUser } = useAuth();
  const router = useRouter();

  // Informations
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [passwordEmail, setPasswordEmail] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [infoErr, setInfoErr] = useState("");
  const [infoBusy, setInfoBusy] = useState(false);

  // Mot de passe
  const [mdpActuel, setMdpActuel] = useState("");
  const [mdpNouveau, setMdpNouveau] = useState("");
  const [mdpConfirm, setMdpConfirm] = useState("");
  const [mdpMsg, setMdpMsg] = useState("");
  const [mdpErr, setMdpErr] = useState("");
  const [mdpBusy, setMdpBusy] = useState(false);

  // Suppression
  const [confirmSuppr, setConfirmSuppr] = useState(false);
  const [mdpSuppr, setMdpSuppr] = useState("");
  const [supprErr, setSupprErr] = useState("");
  const [supprBusy, setSupprBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  // Remplit le formulaire avec les données du compte
  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setEmail(user.email);
  }, [user]);

  const emailChange = user
    ? email.trim().toLowerCase() !== user.email.toLowerCase()
    : false;

  async function enregistrerInfos(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setInfoMsg("");
    setInfoErr("");
    setInfoBusy(true);

    try {
      await api("/profil", {
        method: "PUT",
        token,
        body: {
          name: name.trim(),
          email: email.trim(),
          ...(emailChange ? { password: passwordEmail } : {}),
        },
      });
      await refreshUser();
      setPasswordEmail("");
      setInfoMsg("Vos informations ont été mises à jour.");
    } catch (err) {
      setInfoErr(messageFromError(err));
    } finally {
      setInfoBusy(false);
    }
  }

  async function changerMotDePasse(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMdpMsg("");
    setMdpErr("");
    setMdpBusy(true);

    try {
      await api("/profil/mot-de-passe", {
        method: "PUT",
        token,
        body: {
          current_password: mdpActuel,
          password: mdpNouveau,
          password_confirmation: mdpConfirm,
        },
      });
      setMdpActuel("");
      setMdpNouveau("");
      setMdpConfirm("");
      setMdpMsg(
        "Mot de passe modifié. Vos autres appareils ont été déconnectés.",
      );
    } catch (err) {
      setMdpErr(messageFromError(err));
    } finally {
      setMdpBusy(false);
    }
  }

  async function supprimerCompte(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSupprErr("");
    setSupprBusy(true);

    try {
      await api("/profil", {
        method: "DELETE",
        token,
        body: { password: mdpSuppr },
      });
      await logout();
      router.replace("/login");
    } catch (err) {
      setSupprErr(messageFromError(err));
      setSupprBusy(false);
    }
  }

  if (loading || !user) {
    return (
      <main className="dashboard-loading">
        <span className="dashboard-loader" />
        <p>Chargement de votre profil…</p>
      </main>
    );
  }

  const estAdmin = user.role === "admin";
  const estProducteur = user.role === "producteur";
  const accueil = estAdmin ? "/admin" : "/dashboard";

  return (
    <main className="dashboard-page">
      <header className="dashboard-topbar">
        <Link href={accueil} className="dashboard-brand" aria-label="Watt-Eo, accueil">
          <Image
            src="/images/Watt-Eo-logo.png"
            alt="Watt-Eo"
            width={160}
            height={48}
            priority
            className="home-brand-logo"
          />
        </Link>

        <nav className="dashboard-nav" aria-label="Navigation principale">
          <Link href={accueil}>{estAdmin ? "Administration" : "Tableau de bord"}</Link>
          {!estAdmin && <Link href="/offres">Offres</Link>}
          {!estAdmin && (
            <Link href="/transactions">
              {estProducteur ? "Mes ventes" : "Mes achats"}
            </Link>
          )}
        </nav>

        <div className="dashboard-actions">
          <NotificationBell />
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
            <span className="dashboard-section-kicker">PARAMÈTRES</span>
            <h1>Mon profil</h1>
            <p>Gérez vos informations, votre mot de passe et votre compte.</p>
          </div>
          <span className="dashboard-role">
            <span className="dashboard-role-dot" />
            {estAdmin ? "Administrateur" : estProducteur ? "Producteur" : "Consommateur"}
          </span>
        </section>

        <div className="profil-sections">
          {/* Informations */}
          <section className="profil-card">
            <h2>Informations personnelles</h2>
            <p>Votre nom est visible par les autres utilisateurs lors des échanges.</p>

            {infoMsg && (
              <p className="dashboard-alert dashboard-alert-success" role="status">
                <span aria-hidden="true">✓</span> {infoMsg}
              </p>
            )}
            {infoErr && (
              <p className="dashboard-alert dashboard-alert-error" role="alert">
                <span aria-hidden="true">!</span> {infoErr}
              </p>
            )}

            <form className="profil-form" onSubmit={enregistrerInfos}>
              <div className="profil-field">
                <label htmlFor="profil-nom">Nom</label>
                <input
                  id="profil-nom"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={255}
                  autoComplete="name"
                  required
                />
              </div>

              <div className="profil-field">
                <label htmlFor="profil-email">Adresse email</label>
                <input
                  id="profil-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  maxLength={255}
                  autoComplete="email"
                  required
                />
              </div>

              {emailChange && (
                <div className="profil-field">
                  <label htmlFor="profil-mdp-email">
                    Mot de passe actuel (requis pour changer d’email)
                  </label>
                  <input
                    id="profil-mdp-email"
                    type="password"
                    value={passwordEmail}
                    onChange={(e) => setPasswordEmail(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>
              )}

              <button type="submit" className="profil-btn" disabled={infoBusy}>
                {infoBusy ? "Enregistrement…" : "Enregistrer"}
              </button>
            </form>
          </section>

          {/* Mot de passe */}
          <section className="profil-card">
            <h2>Mot de passe</h2>
            <p>Au moins 8 caractères, avec des lettres et des chiffres.</p>

            {mdpMsg && (
              <p className="dashboard-alert dashboard-alert-success" role="status">
                <span aria-hidden="true">✓</span> {mdpMsg}
              </p>
            )}
            {mdpErr && (
              <p className="dashboard-alert dashboard-alert-error" role="alert">
                <span aria-hidden="true">!</span> {mdpErr}
              </p>
            )}

            <form className="profil-form" onSubmit={changerMotDePasse}>
              <div className="profil-field">
                <label htmlFor="profil-mdp-actuel">Mot de passe actuel</label>
                <input
                  id="profil-mdp-actuel"
                  type="password"
                  value={mdpActuel}
                  onChange={(e) => setMdpActuel(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>

              <div className="profil-field">
                <label htmlFor="profil-mdp-nouveau">Nouveau mot de passe</label>
                <input
                  id="profil-mdp-nouveau"
                  type="password"
                  value={mdpNouveau}
                  onChange={(e) => setMdpNouveau(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>

              <div className="profil-field">
                <label htmlFor="profil-mdp-confirm">Confirmer le nouveau mot de passe</label>
                <input
                  id="profil-mdp-confirm"
                  type="password"
                  value={mdpConfirm}
                  onChange={(e) => setMdpConfirm(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>

              <button type="submit" className="profil-btn" disabled={mdpBusy}>
                {mdpBusy ? "Modification…" : "Changer le mot de passe"}
              </button>
            </form>
          </section>

          {/* Suppression */}
          {!estAdmin && (
            <section className="profil-card profil-card-danger">
              <h2>Supprimer mon compte</h2>
              <p>Cette action est définitive.</p>

              <ul className="profil-list">
                <li>Vos données personnelles sont effacées (nom, email, position).</li>
                <li>
                  Vos transactions passées restent visibles de l’autre partie,
                  sous le nom « Compte supprimé ».
                </li>
                <li>
                  Vos {user.credits.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}{" "}
                  crédits restants seront perdus.
                </li>
                {estProducteur && <li>Vos offres en vente seront retirées.</li>}
                <li>
                  La suppression est impossible tant qu’une commande est en
                  attente : traitez-la d’abord.
                </li>
              </ul>

              {supprErr && (
                <p className="dashboard-alert dashboard-alert-error" role="alert">
                  <span aria-hidden="true">!</span> {supprErr}
                </p>
              )}

              {!confirmSuppr ? (
                <button
                  type="button"
                  className="profil-btn profil-btn-danger"
                  onClick={() => setConfirmSuppr(true)}
                >
                  Supprimer mon compte
                </button>
              ) : (
                <form className="profil-form" onSubmit={supprimerCompte}>
                  <div className="profil-field">
                    <label htmlFor="profil-mdp-suppr">
                      Entrez votre mot de passe pour confirmer
                    </label>
                    <input
                      id="profil-mdp-suppr"
                      type="password"
                      value={mdpSuppr}
                      onChange={(e) => setMdpSuppr(e.target.value)}
                      autoComplete="current-password"
                      required
                    />
                  </div>

                  <div className="profil-actions">
                    <button
                      type="submit"
                      className="profil-btn profil-btn-danger"
                      disabled={supprBusy}
                    >
                      {supprBusy ? "Suppression…" : "Supprimer définitivement"}
                    </button>
                    <button
                      type="button"
                      className="profil-btn profil-btn-ghost"
                      disabled={supprBusy}
                      onClick={() => {
                        setConfirmSuppr(false);
                        setMdpSuppr("");
                        setSupprErr("");
                      }}
                    >
                      Annuler
                    </button>
                  </div>
                </form>
              )}
            </section>
          )}
        </div>
      </div>
    </main>
  );
}