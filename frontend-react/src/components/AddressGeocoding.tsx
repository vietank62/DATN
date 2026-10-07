import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { api } from "../services/api";

type LocationResult = { id: string; address: string; latitude: number; longitude: number; approximate: boolean };
type Address = { address: string; district: string; city: string };

export default function AddressGeocoding({ address, district, city, onSelect }: Address & { onSelect: (latitude: number, longitude: number) => void }) {
  const [selected, setSelected] = useState<LocationResult | null>(null);
  const search = useMutation({
    mutationFn: (input: Address) => api.post<{ results: LocationResult[] }>("/v1/partners/geocode", input, { timeout: 25000 }).then(response => response.data.results),
  });
  const unchanged = search.variables?.address === address && search.variables?.district === district && search.variables?.city === city;
  const results = unchanged ? search.data : undefined;
  const error = unchanged && search.isError ? (axios.isAxiosError(search.error) && typeof search.error.response?.data?.detail === "string" ? search.error.response.data.detail : "Không tìm được vị trí. Vui lòng thử lại.") : null;
  return <div className="mt-3 space-y-3 text-sm font-normal">
    <button type="button" disabled={search.isPending || address.trim().length < 5 || !district || !city} onClick={() => { setSelected(null); search.mutate({ address, district, city }); }} className="rounded-xl border border-red-200 bg-white px-3 py-2 text-red-600 hover:bg-red-50 disabled:opacity-50">
      {search.isPending ? "Đang tìm vị trí..." : "Tìm vị trí từ địa chỉ"}
    </button>
    {error && <p role="alert" className="text-red-600">{error}</p>}
    {results?.length === 0 && <p className="text-gray-600">Không tìm thấy địa chỉ. Hãy nhập địa chỉ rõ hơn hoặc điền tọa độ thủ công.</p>}
    {results && results.length > 0 && <div className="space-y-2">
      <p className="text-xs text-gray-500">Kết quả từ Google Maps · Chọn vị trí phù hợp, kiểm tra tọa độ trước khi lưu.</p>
      {results.map((result, index) => <button key={`${result.id}-${index}`} type="button" onClick={() => { setSelected(result); onSelect(result.latitude, result.longitude); }} className={`block w-full rounded-xl border bg-white p-3 text-left ${selected === result ? "border-red-400" : "border-gray-200 hover:border-red-300"}`}>
        <span className="block text-gray-800">{result.address}</span>
        <span className="mt-1 block text-xs text-gray-500">{result.latitude}, {result.longitude}{result.approximate ? " · Vị trí gần đúng, cần kiểm tra lại" : ""}</span>
      </button>)}
    </div>}
    {unchanged && selected && <a href={`https://www.google.com/maps/search/?api=1&query=${selected.latitude},${selected.longitude}`} target="_blank" rel="noopener noreferrer" className="inline-block text-red-600 underline">Kiểm tra vị trí trên Google Maps</a>}
  </div>;
}
