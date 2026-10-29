import { DocumentStorageType } from "@prisma/client";
const pending = new Map<string,File>();
export async function putFile({file}: {file:File;teamId?:string;[key:string]:any}) {
 if(file.type!=="application/pdf"||file.size>20*1024*1024)throw new Error("This installation accepts PDF files up to 20 MiB. Export other formats to PDF first.");
 const key=crypto.randomUUID();pending.set(key,file);
 return {type:DocumentStorageType.S3_PATH,data:key,numPages:undefined,fileSize:file.size};
}
export function takePendingFile(key:string){ const file=pending.get(key);pending.delete(key);if(!file)throw new Error("Select the PDF again");return file; }
