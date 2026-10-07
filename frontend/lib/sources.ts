export type SourceEnergie = "solaire" | "eolien" | "hydraulique" | "biomasse";

export const SOURCES: { value: SourceEnergie; label: string; icon: string }[] = [
  { value: "solaire", label: "Solaire", icon: "☀️" },
  { value: "eolien", label: "Éolien", icon: "🌬️" },
  { value: "hydraulique", label: "Hydraulique", icon: "💧" },
  { value: "biomasse", label: "Biomasse", icon: "🌿" },
];

export function labelSource(source?: string | null): string {
  return SOURCES.find((s) => s.value === source)?.label ?? "Solaire";
}

export function iconSource(source?: string | null): string {
  return SOURCES.find((s) => s.value === source)?.icon ?? "☀️";
}