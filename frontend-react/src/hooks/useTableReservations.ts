import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";
export type TableReservation={booking_id:number;table_id:number;table_name:string;customer:string;seats:number;meal_at:string;conflict:boolean;attendance?:string|null};
export type Incident={id:number;booking_id:number;table_id:number;table_name:string|null;restaurant_name:string;customer:string;date:string;time:string;state:string;solution?:string;admin_note?:string;reviewed_at?:string;seats:number};
export function useTableReservations(){
 return useQuery<{reservations:TableReservation[];incidents:Incident[]}>({queryKey:["table-reservations"],queryFn:()=>api.get("/v1/table-reservations/me").then(r=>r.data),refetchInterval:10_000,refetchOnWindowFocus:true});
}
