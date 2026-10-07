/** Partition quantities and allocate the original discount without duplicating it. */
export function splitCashierOrder<T extends {id:number;quantity:number;price:number}, O extends {lines:T[];discount:number;depositCredit?:number;vat?:number}>(order:O, quantities:Record<number,number>):{selected:O;remaining:O} {
  const selected:T[]=[];
  const remaining:T[]=[];
  for(const line of order.lines){
    const count=quantities[line.id]??0;
    if(!Number.isInteger(count)||count<0||count>line.quantity)throw new Error("Số lượng tách không hợp lệ");
    if(count)selected.push({...line,quantity:count});
    if(count<line.quantity)remaining.push({...line,quantity:line.quantity-count});
  }
  if(!selected.length)throw new Error("Chọn ít nhất một món để tách bill");
  const subtotal=order.lines.reduce((sum,l)=>sum+l.quantity*l.price,0);
  const selectedSubtotal=selected.reduce((sum,l)=>sum+l.quantity*l.price,0);
  const discount=Math.min(subtotal,Math.max(0,order.discount));
  const selectedDiscount=remaining.length?(subtotal?Math.round(discount*selectedSubtotal/subtotal):0):discount;
  const net=Math.max(0,selectedSubtotal-selectedDiscount);
  const credit=Math.min(order.depositCredit??0,net+Math.round(net*(order.vat??0)/100));
  return {selected:{...order,lines:selected,discount:selectedDiscount,depositCredit:credit},remaining:{...order,lines:remaining,discount:discount-selectedDiscount,depositCredit:Math.max(0,(order.depositCredit??0)-credit)}};
}
