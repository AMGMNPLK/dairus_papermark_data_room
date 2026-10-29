import { useTeam } from "@/context/team-context";
import useSWR from "swr";
import { fetcher } from "@/lib/utils";
export interface Limits { documents:number;links:number;users:number;datarooms:number;usage:{documents:number;links:number;users:number};fileSizeLimits?:any;[key:string]:any }
export function useLimits() {
 const { currentTeam } = useTeam();
 const { data, error } = useSWR<Limits>(currentTeam ? `/api/teams/${currentTeam.id}/limits` : null, fetcher);
 return { limits:data, canAddDocuments: !!data && data.usage.documents < data.documents, canAddLinks:false, canAddUsers:false, showUpgradePlanModal:true, isPaused:false, loading:!data&&!error, error };
}
export default useLimits;
