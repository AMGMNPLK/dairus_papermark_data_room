// Community private-room form, adapted 2026-10-09. AGPL-3.0-only.
import { useState, type FormEvent, type ReactNode, type Dispatch, type SetStateAction } from "react";
import { useRouter } from "next/router";
import { useTeam } from "@/context/team-context";
import { mutate } from "swr";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog,DialogContent,DialogDescription,DialogTitle,DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
export function AddDataroomModal({children,openModal=false,setOpenModal}:{children?:ReactNode,openModal?:boolean,setOpenModal?:Dispatch<SetStateAction<boolean>>}) {
 const [open,setOpen]=useState(false),[name,setName]=useState(""),[busy,setBusy]=useState(false),team=useTeam(),router=useRouter();
 const change=(v:boolean)=>{setOpen(v);setOpenModal?.(v);if(!v)setName("");};
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);try{const r=await fetch(`/api/teams/${team?.currentTeam?.id}/datarooms`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name})});const data=await r.json();if(!r.ok)throw Error(data.message||"Room creation failed");await mutate(`/api/teams/${team?.currentTeam?.id}/datarooms`);change(false);await router.push(`/datarooms/${data.dataroom.id}/documents`);}catch(e){toast.error(e instanceof Error?e.message:"Room creation failed");}finally{setBusy(false);}}
 return <Dialog open={open||openModal} onOpenChange={change}>{children&&<DialogTrigger asChild>{children}</DialogTrigger>}<DialogContent><DialogTitle>Create New Dataroom</DialogTitle><DialogDescription>Create a private room to organize your PDFs. No link, invitation or notification is created.</DialogDescription><form onSubmit={submit} className="space-y-4"><div className="space-y-2"><Label htmlFor="room-name">Dataroom name</Label><Input id="room-name" value={name} onChange={e=>setName(e.target.value)} required maxLength={100}/></div><Button type="submit" disabled={busy}>{busy?"Creating…":"Create Dataroom"}</Button></form></DialogContent></Dialog>;
}
