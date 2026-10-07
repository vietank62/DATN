import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import { LocateFixed, MapPin, Navigation, Utensils } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../services/api";
import type { RestaurantCard } from "../../types/restaurant";
import "leaflet/dist/leaflet.css";

type Coordinates = { latitude: number; longitude: number };
type AddressResult = Coordinates & { id: string; address: string; approximate: boolean };
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
  const latitude = center[0];
  const longitude = center[1];

  useEffect(() => {
    map.setView([latitude, longitude], zoom, { animate: true });
    const resizeTimer = window.setTimeout(() => map.invalidateSize(), 0);
    return () => window.clearTimeout(resizeTimer);
  }, [latitude, longitude, map, zoom]);

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
  const [params] = useSearchParams();
  const [address, setAddress] = useState(params.get("address") ?? "");
  const addressLookup = useMutation({mutationFn:(query:string)=>api.get<{results:AddressResult[]}>("/v1/restaurants/address-location",{params:{address:query},timeout:25000}).then(response=>response.data)});
  const [position, setPosition] = useState<Coordinates | null>(null);
  const [latitudeInput, setLatitudeInput] = useState("");
  const [longitudeInput, setLongitudeInput] = useState("");
  const [manualPosition, setManualPosition] = useState(false);
  const [coordinateError, setCoordinateError] = useState(false);
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
      ({ coords }) => { setPosition({ latitude: coords.latitude, longitude: coords.longitude }); setLatitudeInput(String(coords.latitude)); setLongitudeInput(String(coords.longitude)); setManualPosition(false); setCoordinateError(false); setIsLocating(false); },
      (error) => { setLocationError(error.code === error.PERMISSION_DENIED ? "map.denied" : "map.locationFailed"); setIsLocating(false); },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  };
  const findCoordinates = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const latitude = Number(latitudeInput.trim());
    const longitude = Number(longitudeInput.trim());
    if (!latitudeInput.trim() || !longitudeInput.trim() || !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      setCoordinateError(true);
      return;
    }
    setCoordinateError(false);
    setLocationError(null);
    setManualPosition(true);
    setPosition({ latitude, longitude });
  };
  const center: [number, number] = position ? [position.latitude, position.longitude] : DEFAULT_CENTER;
  const restaurants = nearbyQuery.data ?? [];
  return <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
    <h1 className="nearby-map-title mb-5 font-normal text-gray-900">{t("map.title")}</h1>
    <form onSubmit={event=>{event.preventDefault();if(address.trim().length>=5)addressLookup.mutate(address.trim());}} className="mb-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <label htmlFor="map-address" className="block text-sm text-gray-700">Tìm theo địa chỉ</label>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row"><input id="map-address" value={address} maxLength={500} onChange={event=>{setAddress(event.target.value);addressLookup.reset();}} placeholder="Ví dụ: 171 Đồng Khởi, Quận 1, TP. Hồ Chí Minh" className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2.5 outline-none focus:border-red-400" /><button type="button" disabled={!address.trim()} onClick={()=>navigate(`/search?${new URLSearchParams({search:address.trim()})}`)} className="rounded-xl border border-red-200 px-4 py-2.5 text-sm text-red-700 disabled:opacity-50">Tìm trong địa chỉ nhà hàng</button><button disabled={address.trim().length<5||addressLookup.isPending} className="rounded-xl bg-red-600 px-4 py-2.5 text-sm text-white disabled:opacity-50">{addressLookup.isPending?"Đang tìm vị trí...":"Tìm nhà hàng gần địa chỉ"}</button></div>
      {addressLookup.isError&&<p role="alert" className="mt-3 text-sm text-red-700">{axios.isAxiosError(addressLookup.error)&&addressLookup.error.response?.status===401?"Vui lòng đăng nhập để tìm vị trí địa chỉ.":axios.isAxiosError(addressLookup.error)&&typeof addressLookup.error.response?.data?.detail==="string"?addressLookup.error.response.data.detail:"Không tìm được vị trí. Vui lòng thử lại."}</p>}
      {addressLookup.isSuccess&&addressLookup.variables===address.trim()&&<div className="mt-3 space-y-2">{!addressLookup.data.results.length?<p className="text-sm text-gray-500">Không tìm thấy địa chỉ. Hãy thêm quận và thành phố hoặc nhập tọa độ bên dưới.</p>:<><p className="text-sm text-gray-500">Chọn vị trí đúng để tìm nhà hàng xung quanh:</p>{addressLookup.data.results.map(result=><button key={result.id} type="button" onClick={()=>{setPosition({latitude:result.latitude,longitude:result.longitude});setLatitudeInput(String(result.latitude));setLongitudeInput(String(result.longitude));setManualPosition(true);setCoordinateError(false);setLocationError(null);}} className="block w-full rounded-xl border border-gray-200 px-3 py-2 text-left text-sm text-gray-700 hover:border-red-300 hover:bg-red-50">{result.address}</button>)}</>}</div>}
    </form>
    <form onSubmit={findCoordinates} className="mb-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
        <label htmlFor="map-latitude" className="text-gray-700">{t("map.latitude")}
          <input id="map-latitude" type="number" step="any" min="-90" max="90" value={latitudeInput} onChange={e=>{setLatitudeInput(e.target.value);setCoordinateError(false);}} placeholder="10.7769" className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100" />
        </label>
        <label htmlFor="map-longitude" className="text-gray-700">{t("map.longitude")}
          <input id="map-longitude" type="number" step="any" min="-180" max="180" value={longitudeInput} onChange={e=>{setLongitudeInput(e.target.value);setCoordinateError(false);}} placeholder="106.7009" className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100" />
        </label>
        <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row lg:col-span-1">
        <button type="submit" disabled={isLocating} className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-white hover:bg-red-700 disabled:opacity-60"><MapPin size={18} />{t("map.findCoordinates")}</button>
          <button type="button" onClick={locateCustomer} disabled={isLocating} className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-normal text-gray-700 transition hover:border-red-300 hover:bg-red-50 disabled:opacity-60"><LocateFixed size={18} />{isLocating ? t("map.locating") : position ? t("map.update") : t("map.useLocation")}</button>
        </div>
      </div>
      {coordinateError && <p role="alert" className="mt-3 text-red-700">{t("map.invalidCoordinates")}</p>}
    </form>
    {locationError && <p role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{t(locationError)}</p>}
    {!position && <p className="mb-4 rounded-xl bg-gray-100 px-4 py-3 text-sm text-gray-600">{t("map.defaultCenter")}</p>}
    <div className="mb-4 flex flex-wrap items-center gap-2"><span className="mr-1 text-sm font-medium text-gray-700">{t("map.radius")}</span>{RADIUS_OPTIONS.map((option) => <button key={option} type="button" onClick={() => setRadius(option)} disabled={!position} className={["rounded-full px-3 py-1.5 text-sm font-semibold transition", radius === option ? "bg-red-600 text-white" : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50", "disabled:cursor-not-allowed disabled:opacity-50"].join(" ")}>{option} km</button>)}{position && <span className="ml-auto text-sm text-gray-500">{nearbyQuery.isFetching ? t("map.searching") : t("map.count", { count: restaurants.length })}</span>}</div>
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]"><div className="relative z-0 isolate h-[560px] overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 shadow-sm"><MapContainer center={DEFAULT_CENTER} zoom={12} className="h-full w-full" scrollWheelZoom><BaseMapTiles /><MapViewport center={center} zoom={position ? 14 : 12} />{position && <><Circle center={center} radius={radius * 1000} pathOptions={{ color: "#dc2626", fillColor: "#fecaca", fillOpacity: 0.16 }} /><CircleMarker center={center} radius={9} pathOptions={{ color: "#1d4ed8", fillColor: "#2563eb", fillOpacity: 1 }}><Popup>{t(manualPosition ? "map.selectedPosition" : "map.you")}</Popup></CircleMarker></>}{restaurants.map((restaurant) => restaurant.latitude !== null && restaurant.latitude !== undefined && restaurant.longitude !== null && restaurant.longitude !== undefined && <CircleMarker key={restaurant.id} center={[restaurant.latitude, restaurant.longitude]} radius={9} pathOptions={{ color: "#991b1b", fillColor: "#ef4444", fillOpacity: 1 }}><Popup><div className="min-w-45 space-y-1.5"><b>{restaurant.name}</b><p>{restaurant.address}</p><p className="font-normal text-red-700">{formatDistance(restaurant.distance_km)}</p><button type="button" className="font-normal text-red-700 underline" onClick={() => navigate("/restaurant/" + restaurant.id)}>{t("map.book")}</button></div></Popup></CircleMarker>)}</MapContainer></div>
    <aside className="max-h-[560px] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-3 shadow-sm"><h2 className="px-2 py-2 font-bold text-gray-900">{t("map.results")}</h2>{nearbyQuery.isLoading && <p className="p-3 text-sm text-gray-500">{t("map.loading")}</p>}{nearbyQuery.isError && <p className="m-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">{t("map.failed")}</p>}{position && !nearbyQuery.isLoading && !nearbyQuery.isError && restaurants.length === 0 && <p className="p-3 text-sm text-gray-500">{t("map.empty", { radius })}</p>}{!position && <div className="p-3 text-sm text-gray-500"><MapPin className="mb-2 text-red-600" size={22} />{t("map.enable")}</div>}{restaurants.map((restaurant) => <button key={restaurant.id} type="button" onClick={() => navigate("/restaurant/" + restaurant.id)} className="w-full rounded-xl p-3 text-left transition hover:bg-red-50"><div className="flex gap-3"><div className="mt-0.5 rounded-lg bg-red-50 p-2 text-red-600"><Utensils size={16} /></div><div className="min-w-0"><p className="truncate font-semibold text-gray-900">{restaurant.name}</p><p className="mt-1 line-clamp-2 text-xs text-gray-500">{restaurant.address}</p><p className="mt-1.5 inline-flex items-center gap-1 text-sm font-bold text-red-700"><Navigation size={14} />{formatDistance(restaurant.distance_km)}</p></div></div></button>)}</aside></div>
  </div>;
}
