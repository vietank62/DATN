export default function RestaurantTableGraphic({seats=4,name,selected=false,occupied=false}:{seats?:number;name?:string;selected?:boolean;occupied?:boolean}) {
  const highlighted=occupied||selected;
  const chairs=Math.min(seats,12);
  return <svg viewBox="0 0 180 150" className="mx-auto h-36 w-full max-w-52" role="img" aria-label={name ? `Bàn ${name}, ${seats} chỗ` : `Bàn ${seats} chỗ`}>
    {Array.from({length:chairs},(_,i)=>{const angle=2*Math.PI*i/chairs-Math.PI/2;const x=90+67*Math.cos(angle),y=75+54*Math.sin(angle);return <rect key={i} x={x-12} y={y-9} width="24" height="18" rx="5" fill={highlighted?"#fed7aa":"#ffffff"} stroke={highlighted?"#fb923c":"#d1d5db"} strokeWidth="2" transform={`rotate(${angle*180/Math.PI+90} ${x} ${y})`}/>;})}
    <rect x="46" y="39" width="88" height="72" rx="18" fill={highlighted?"#ea580c":"#ffffff"} stroke={highlighted?"#ea580c":"#d1d5db"} strokeWidth="3"/>
    <text x="90" y="71" textAnchor="middle" fill={highlighted?"white":"#374151"} fontSize="17" fontWeight="400">{name?.slice(0,10)||"Bàn"}</text>
    <text x="90" y="94" textAnchor="middle" fill={highlighted?"white":"#6b7280"} fontSize="14">{seats} chỗ</text>
  </svg>;
}
