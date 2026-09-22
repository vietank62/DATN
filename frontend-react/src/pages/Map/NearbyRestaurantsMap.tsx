import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import { LocateFixed, MapPin, Navigation, Utensils } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../../services/api";
import type { RestaurantCard } from "../../types/restaurant";
import "leaflet/dist/leaflet.css";

type Coordinates = { latitude: number; longitude: number };
const DEFAULT_CENTER: [number, number] = [10.7769, 106.7009];
const RADIUS_OPTIONS = [1, 3, 5, 10] as const;
const TILE_SOURCES = [
  {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  {
    url: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, tiles by <a href="https://www.openstreetmap.fr">OpenStreetMap France</a>',
  },
] as const;
const formatDistance = (distance?: number) => distance === undefined ? "" : distance < 1 ? Math.round(distance * 1000) + " m" : distance.toFixed(1) + " km";

function MapViewport({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, zoom, { animate: true });
    const resizeTimer = window.setTimeout(() => map.invalidateSize(), 0);
    return () => window.clearTimeout(resizeTimer);
  }, [center[0], center[1], map, zoom]);

  return null;
}

function BaseMapTiles() {
  const [sourceIndex, setSourceIndex] = useState(0);
  const source = TILE_SOURCES[sourceIndex];

  return <TileLayer
    key={source.url}
    attribution={source.attribution}
    url={source.url}
    detectRetina
    eventHandlers={{
      tileerror: () => setSourceIndex((current) => Math.min(current + 1, TILE_SOURCES.length - 1)),
    }}
  />;
}

export default function NearbyRestaurantsMap() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [position, setPosition] = useState<Coordinates | null>(null);
  const [radius, setRadius] = useState<(typeof RADIUS_OPTIONS)[number]>(5);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const nearbyQuery = useQuery<RestaurantCard[]>({
    queryKey: ["nearby-restaurants", position?.latitude, position?.longitude, radius],
    queryFn: () => api.get("/v1/restaurants/nearby", { params: { latitude: position?.latitude, longitude: position?.longitude, radius_km: radius } }).then((response) => response.data),
    enabled: position !== null,
    staleTime: 30_000,
  });
  const locateCustomer = () => {
    if (!navigator.geolocation) { setLocationError("map.unsupported"); return; }
    setIsLocating(true); setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { setPosition({ latitude: coords.latitude, longitude: coords.longitude }); setIsLocating(false); },
      (error) => { setLocationError(error.code === error.PERMISSION_DENIED ? "map.denied" : "map.locationFailed"); setIsLocating(false); },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  };
  const center: [number, number] = position ? [position.latitude, position.longitude] : DEFAULT_CENTER;
  const restaurants = nearbyQuery.data ?? [];
  return <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
    <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-bold text-gray-900">{t("map.title")}</h1><p className="mt-1 text-sm text-gray-600">{t("map.subtitle")}</p></div><button type="button" onClick={locateCustomer} disabled={isLocating} className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-60"><LocateFixed size={18} />{isLocating ? t("map.locating") : position ? t("map.update") : t("map.useLocation")}</button></div>
    {locationError && <p role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{t(locationError)}</p>}
    {!position && <p className="mb-4 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-600">{t("map.defaultCenter")}</p>}
    <div className="mb-4 flex flex-wrap items-center gap-2"><span className="mr-1 text-sm font-medium text-gray-700">{t("map.radius")}</span>{RADIUS_OPTIONS.map((option) => <button key={option} type="button" onClick={() => setRadius(option)} disabled={!position} className={["rounded-full px-3 py-1.5 text-sm font-semibold transition", radius === option ? "bg-red-600 text-white" : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50", "disabled:cursor-not-allowed disabled:opacity-50"].join(" ")}>{option} km</button>)}{position && <span className="ml-auto text-sm text-gray-500">{nearbyQuery.isFetching ? t("map.searching") : t("map.count", { count: restaurants.length })}</span>}</div>
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]"><div className="relative z-0 isolate h-[560px] overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 shadow-sm"><MapContainer center={DEFAULT_CENTER} zoom={12} className="h-full w-full" scrollWheelZoom><BaseMapTiles /><MapViewport center={center} zoom={position ? 14 : 12} />{position && <><Circle center={center} radius={radius * 1000} pathOptions={{ color: "#dc2626", fillColor: "#fecaca", fillOpacity: 0.16 }} /><CircleMarker center={center} radius={9} pathOptions={{ color: "#1d4ed8", fillColor: "#2563eb", fillOpacity: 1 }}><Popup>{t("map.you")}</Popup></CircleMarker></>}{restaurants.map((restaurant) => restaurant.latitude !== null && restaurant.latitude !== undefined && restaurant.longitude !== null && restaurant.longitude !== undefined && <CircleMarker key={restaurant.id} center={[restaurant.latitude, restaurant.longitude]} radius={9} pathOptions={{ color: "#991b1b", fillColor: "#ef4444", fillOpacity: 1 }}><Popup><div className="min-w-45 space-y-1.5"><b>{restaurant.name}</b><p>{restaurant.address}</p><p className="font-semibold text-red-700">{formatDistance(restaurant.distance_km)}</p><button type="button" className="font-semibold text-blue-700 underline" onClick={() => navigate("/restaurant/" + restaurant.id)}>{t("map.book")}</button></div></Popup></CircleMarker>)}</MapContainer></div>
    <aside className="max-h-[560px] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-3 shadow-sm"><h2 className="px-2 py-2 font-bold text-gray-900">{t("map.results")}</h2>{nearbyQuery.isLoading && <p className="p-3 text-sm text-gray-500">{t("map.loading")}</p>}{nearbyQuery.isError && <p className="m-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">{t("map.failed")}</p>}{position && !nearbyQuery.isLoading && !nearbyQuery.isError && restaurants.length === 0 && <p className="p-3 text-sm text-gray-500">{t("map.empty", { radius })}</p>}{!position && <div className="p-3 text-sm text-gray-500"><MapPin className="mb-2 text-red-600" size={22} />{t("map.enable")}</div>}{restaurants.map((restaurant) => <button key={restaurant.id} type="button" onClick={() => navigate("/restaurant/" + restaurant.id)} className="w-full rounded-xl p-3 text-left transition hover:bg-red-50"><div className="flex gap-3"><div className="mt-0.5 rounded-lg bg-red-50 p-2 text-red-600"><Utensils size={16} /></div><div className="min-w-0"><p className="truncate font-semibold text-gray-900">{restaurant.name}</p><p className="mt-1 line-clamp-2 text-xs text-gray-500">{restaurant.address}</p><p className="mt-1.5 inline-flex items-center gap-1 text-sm font-bold text-red-700"><Navigation size={14} />{formatDistance(restaurant.distance_km)}</p></div></div></button>)}</aside></div>
  </div>;
}
