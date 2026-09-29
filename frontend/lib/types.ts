export type Offre = {
  id: number;
  producteur_id: number;
  quantite_kwh: number;
  prix_kwh: number;
  latitude: number | null;
  longitude: number | null;
  disponible: boolean;
  producteur?: { id: number; name: string };
  distance_km?: number;
};

export type Transaction = {
  id: number;
  offre_id: number;
  consommateur_id: number;
  quantite_kwh: number;
  prix_total: number;
  statut: "en_attente" | "confirmee" | "annulee";
  created_at: string;
  offre?: Offre;
  consommateur?: { id: number; name: string };
};

export type LigneMensuelle = {
  mois: string;
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
  co2_evite_kg: number;
  evolution_mensuelle: LigneMensuelle[];
};

export type DashboardConsommateur = {
  role: "consommateur";
  credits: number;
  nombre_achats: number;
  kwh_achetes: number;
  depenses: number;
  economies: number;
  co2_evite_kg: number;
  evolution_mensuelle: LigneMensuelle[];
};

export type DashboardData = DashboardProducteur | DashboardConsommateur;