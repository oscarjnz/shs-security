/*
 * Mapa Leaflet con tiles oscuros (CARTO dark) que combinan con el tema de S.S.S.
 * Se carga de forma DIFERIDA (React.lazy en la pagina) para no inflar el bundle
 * principal: leaflet + react-leaflet pesan ~150KB y solo hacen falta aqui.
 */

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Pin propio con divIcon: evita el problema clasico de los iconos PNG de leaflet
// (que se rompen con los bundlers) y ademas lo pintamos en verde cyber.
const pinIcon = L.divIcon({
  className: "sss-geo-pin",
  html: `
    <span style="position:relative;display:block;width:22px;height:22px">
      <span style="position:absolute;inset:0;border-radius:9999px;background:rgba(0,255,136,0.25);animation:sssGeoPulse 2s ease-out infinite"></span>
      <span style="position:absolute;top:50%;left:50%;width:12px;height:12px;transform:translate(-50%,-50%);border-radius:9999px;background:#00ff88;box-shadow:0 0 0 2px rgba(10,14,26,0.9),0 0 12px 2px rgba(0,255,136,0.7)"></span>
    </span>
  `,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  popupAnchor: [0, -12],
});

interface GeoMapProps {
  lat: number;
  lon: number;
  label: string;
}

export default function GeoMap({ lat, lon, label }: GeoMapProps) {
  return (
    <MapContainer
      // Remontamos al cambiar de coords: la forma mas simple y robusta de
      // recentrar el mapa cuando el usuario consulta otra IP.
      key={`${lat},${lon}`}
      center={[lat, lon]}
      zoom={10}
      scrollWheelZoom={false}
      style={{ height: "100%", width: "100%", background: "#0a0e1a" }}
      attributionControl={true}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        maxZoom={19}
      />
      <Marker position={[lat, lon]} icon={pinIcon}>
        <Popup>{label}</Popup>
      </Marker>
    </MapContainer>
  );
}
