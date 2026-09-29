"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import type { Offre } from "@/lib/types";

type Point = Offre & { latitude: number; longitude: number };

// Icône dessinée en CSS : évite les problèmes d'images de Leaflet avec Next.js
const pin = L.divIcon({
  className: "offre-pin",
  html: "⚡",
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
});

/** Cadre la carte sur l'ensemble des offres affichées. */
function Ajuster({ points }: { points: Point[] }) {
  const map = useMap();
  const cle = points.map((p) => p.id).join(",");

  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].latitude, points[0].longitude], 13);
      return;
    }
    map.fitBounds(
      L.latLngBounds(points.map((p) => [p.latitude, p.longitude] as [number, number])),
      { padding: [40, 40], maxZoom: 14 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle, map]);

  return null;
}

/** Centre la carte sur l'offre sélectionnée. */
function Suivre({ point }: { point?: Point }) {
  const map = useMap();
  const lat = point?.latitude;
  const lng = point?.longitude;

  useEffect(() => {
    if (lat === undefined || lng === undefined) return;
    map.flyTo([lat, lng], Math.max(map.getZoom(), 14));
  }, [lat, lng, map]);

  return null;
}

export default function OffresMap({
  offres,
  selectedId,
  onSelect,
  position,
}: {
  offres: Offre[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  position: { lat: number; lng: number } | null;
}) {
  const points = offres.filter(
    (o): o is Point => o.latitude !== null && o.longitude !== null,
  );
  const selected = points.find((p) => p.id === selectedId);

  return (
    <div className="map-box">
      <MapContainer
        center={position ? [position.lat, position.lng] : [6.17, 1.23]}
        zoom={12}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <Ajuster points={points} />
        <Suivre point={selected} />

        {position && (
          <CircleMarker
            center={[position.lat, position.lng]}
            radius={8}
            pathOptions={{ color: "#2563eb" }}
          >
            <Popup>Vous êtes ici</Popup>
          </CircleMarker>
        )}

        {points.map((o) => (
          <Marker
            key={o.id}
            position={[o.latitude, o.longitude]}
            icon={pin}
            eventHandlers={{ click: () => onSelect(o.id) }}
          >
            <Popup>
              <strong>{o.producteur?.name ?? "Producteur"}</strong>
              <br />
              {o.quantite_kwh} kWh à {o.prix_kwh} crédits/kWh
              {o.distance_km !== undefined && (
                <>
                  <br />À {o.distance_km.toFixed(1)} km
                </>
              )}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}