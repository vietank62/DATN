type KitchenLine={id:number;name:string;quantity:number};
export function kitchenChanges(current:KitchenLine[],previous:KitchenLine[]=[]):string[]{
  const rows:string[]=[];
  const before=new Map(previous.map(l=>[l.id,l]));
  for(const line of current){
    const old=before.get(line.id)?.quantity??0;
    if(line.quantity>old)rows.push(`THÊM: ${line.name} × ${line.quantity-old}`);
    else if(line.quantity<old)rows.push(`GIẢM: ${line.name} × ${old-line.quantity} (còn ${line.quantity})`);
    before.delete(line.id);
  }
  for(const old of before.values())rows.push(`HỦY: ${old.name} × ${old.quantity}`);
  return rows;
}
