import prisma from "@/lib/prisma";
import { owner,safe,HttpError } from "../../../server/core";
import {json,unavailable} from "../../../server/native-ui";
export async function PATCH(request:Request){return safe(async()=>{const user=await owner(request,true),data=await request.json();if(Object.keys(data).length!==1||typeof data.name!=="string")return unavailable();if(!data.name.trim()||data.name.length>32||/[<>\x00-\x1f]/.test(data.name))throw new HttpError(400,"Use 1–32 plain characters");return json(await prisma.user.update({where:{id:user.id},data:{name:data.name.trim()},select:{name:true}}));});}
