import { ArrowLeft, ArrowRight } from "lucide-react";

export default function ImageOrderControls({ index, count, disabled, onMove }: { index: number; count: number; disabled?: boolean; onMove: (to: number) => void }) {
  return <div className="absolute left-2 top-2 flex gap-1 rounded-lg bg-black/70 p-1 text-white">
    <button type="button" aria-label={`Đưa ảnh ${index + 1} lên trước`} title="Đưa lên trước" disabled={disabled || index === 0} onClick={() => onMove(index - 1)} className="rounded p-1.5 hover:bg-white/20 disabled:opacity-30"><ArrowLeft size={15} /></button>
    <button type="button" aria-label={`Đưa ảnh ${index + 1} ra sau`} title="Đưa ra sau" disabled={disabled || index === count - 1} onClick={() => onMove(index + 1)} className="rounded p-1.5 hover:bg-white/20 disabled:opacity-30"><ArrowRight size={15} /></button>
  </div>;
}
