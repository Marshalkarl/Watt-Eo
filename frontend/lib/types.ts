import type { SourceEnergie } from "./sources";


export type Offre = {
  id: number;
  producteur_id: number;
  quantite_kwh: number;
  prix_kwh: number;
  source: SourceEnergie;
  latitude: number | null;
  longitude: number | null;
  disponible: boolean;
  retiree?: boolean | number;
  motif_retrait?: string | null;
  producteur?: { id: number; name: string };
  distance_km?: number;
};

export type Transaction = {
  id: number;
  offre_id: number;
  consommateur_id: number;
  quantite_kwh: number;
  prix_total: number;
  commission?: number | null;
  montant_net?: number | null;
  statut: "en_attente" | "confirmee" | "annulee";
  created_at: string;
  offre?: Offre;
  consommateur?: { id: number; name: string };
};

export type LigneJournaliere = {
  jour: string; // format "2026-09-30"
  kwh: number | string;
  total: number | string;
};


export type DashboardProducteur = {
  role: "producteur";
  credits: number;
  nombre_ventes: number;
  kwh_vendus: number;
  revenus: number;
  offres_actives: number;
  kwh_en_vente: number;
  commissions: number;
  co2_evite_kg: number;
  evolution_journaliere: LigneJournaliere[];
};

export type DashboardConsommateur = {
  role: "consommateur";
  credits: number;
  nombre_achats: number;
  kwh_achetes: number;
  depenses: number;
  economies: number;
  co2_evite_kg: number;
  evolution_journaliere: LigneJournaliere[];
};

export type DashboardData = DashboardProducteur | DashboardConsommateur;

export type MouvementCredit = {
  id: number;
  type: "recharge" | "achat" | "vente" | "remboursement";
  montant: number;
  solde_apres: number;
  description: string | null;
  created_at: string;
};

export type Compteur = {
  id: number;
  user_id: number;
  nom: string;
  type: "production" | "consommation";
  source: "solaire" | "eolien" | "hydraulique" | "biomasse" | null;
  puissance_kwc: number | null;
  actif: boolean;
};

export type BilanEnergie = {
  periode_jours: number;
  production_kwh: number;
  consommation_kwh: number;
  vendu_kwh: number;
  en_attente_kwh: number;
  en_vente_kwh: number;
  surplus_kwh: number;
  autosuffisance_pct: number | null;
};

export type LigneReleve = {
  periode: string;
  energie_kwh: number | string;
};

export type HistoriqueReleves = {
  compteur: Compteur;
  pas: "heure" | "jour";
  total_kwh: number;
  releves: LigneReleve[];
};

export type RepereMarche = {
  tarif_reseau_kwh: number;
  prix_plancher_kwh: number;
  prix_plafond_kwh: number;
  prix_suggere: number;
  prix_moyen: number | null;
  economie_pct: number | null;
};

export type Paginated<T> = {
  data: T[];
  current_page: number;
  last_page: number;
  total: number;
};

export type AdminDashboard = {
  utilisateurs: { producteurs: number; consommateurs: number; suspendus: number };
  offres: { total: number; actives: number };
  transactions: { en_attente: number; confirmees: number; annulees: number };
  kwh_echanges: number;
  volume_credits: number;
  commissions_totales: number;
  co2_evite_kg: number;
  kwh_par_source: Record<string, number>;
  evolution_journaliere: {
    jour: string;
    nombre: number;
    kwh: number;
    volume: number;
    commissions: number;
  }[];
};

export type AdminUser = {
  id: number;
  name: string;
  email: string;
  role: "producteur" | "consommateur" | "admin";
  actif: boolean;
  credits: number;
  created_at: string;
};

export type AuditEntry = {
  id: number;
  user_id: number | null;
  action: string;
  cible_type: string | null;
  cible_id: number | null;
  details: Record<string, unknown> | null;
  ip: string | null;
  created_at: string;
  user?: { id: number; name: string; email: string; role: string } | null;
};