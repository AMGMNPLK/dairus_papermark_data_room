import { useTeam } from "@/context/team-context";
import useSWR from "swr";
import {fetcher} from "@/lib/utils";
export function useDocumentProgressStatus(documentVersionId:string,_unused?:string){
 const {currentTeam}=useTeam();
 const {data,error}=useSWR<{hasPages:boolean;failed:boolean}>(currentTeam?`/api/teams/${currentTeam.id}/documents/document-processing-status?documentVersionId=${documentVersionId}`:null,fetcher,{refreshInterval:(data)=>data?.hasPages||data?.failed?0:1500});
 return {status:{state:data?.failed?"FAILED":data?.hasPages?"COMPLETED":"EXECUTING",progress:data?.hasPages?100:0,text:data?.failed?"PDF processing failed":"Preparing PDF preview..."},error,run:undefined};
}
