"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";

export default function Navbar() {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOuvert, setMenuOuvert] = useState(false);

  // L’accueil possède déjà son propre en-tête.
  if (pathname === "/") return null;

  const liens = [{ href: "/offres", label: "Offres" }];

  if (user?.role === "producteur") {
    liens.push(
      { href: "/mes-offres", label: "Mes offres" },
      { href: "/installation", label: "Mon installation" },
      { href: "/commandes", label: "Commandes" },
      { href: "/transactions", label: "Mes ventes" },
    );
  }

  if (user?.role === "consommateur") {
    liens.push({ href: "/transactions", label: "Mes achats" });
  }

  if (user?.role === "admin") {
    liens.push({ href: "/admin", label: "Administration" });
  } else if (user) {
    liens.push({ href: "/dashboard", label: "Tableau de bord" });
  }

  const actif = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  async function seDeconnecter() {
    setMenuOuvert(false);
    await logout();
    router.push("/login");
  }

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link
          href="/"
          className="navbar-brand"
          onClick={() => setMenuOuvert(false)}
        >
          <span className="navbar-brand-icon" aria-hidden="true">
            ⚡
          </span>
          <span>Énergie P2P</span>
        </Link>

        <button
          type="button"
          className="navbar-toggle"
          aria-label={menuOuvert ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={menuOuvert}
          onClick={() => setMenuOuvert((ouvert) => !ouvert)}
        >
          <span />
          <span />
          <span />
        </button>

        <div className={`navbar-content${menuOuvert ? " ouvert" : ""}`}>
          <nav className="navbar-links" aria-label="Navigation principale">
            {liens.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={actif(l.href) ? "navbar-link actif" : "navbar-link"}
                onClick={() => setMenuOuvert(false)}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="navbar-right">
            {loading ? (
              <span className="navbar-loading">Chargement…</span>
            ) : user ? (
              <>
                <span className="navbar-user">
                  <strong>{user.name}</strong>
                  {user.role !== "admin" && <span>{user.credits} crédits</span>}
                </span>

                <button
                  type="button"
                  className="navbar-logout"
                  onClick={seDeconnecter}
                >
                  Se déconnecter
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="navbar-link"
                  onClick={() => setMenuOuvert(false)}
                >
                  Connexion
                </Link>
                <Link
                  href="/register"
                  className="navbar-register"
                  onClick={() => setMenuOuvert(false)}
                >
                  Inscription
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}