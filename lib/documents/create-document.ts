import { DocumentStorageType } from "@prisma/client";
import z from "zod";

export type DocumentData = {
  name: string;
  key: string;
  storageType: DocumentStorageType;
  contentType: string | null; // actual file mime type
  supportedFileType: string; // papermark types: "pdf", "sheet", "docs", "slides", "map", "zip"
  fileSize: number | undefined; // file size in bytes
  numPages?: number;
  enableExcelAdvancedMode?: boolean;
};

import { takePendingFile } from "@/lib/files/put-file";
async function privateUpload(documentData:DocumentData,documentId?:string,folderPathName?:string) {
 const file=takePendingFile(documentData.key);
 const params=new URLSearchParams();if(documentId)params.set("documentId",documentId);if(folderPathName)params.set("folderPathName",folderPathName);
 const result=await fetch(`/api/upload?${params}`,{method:"POST",headers:{"Content-Type":"application/pdf","x-document-name":encodeURIComponent(file.name)},body:file});
 const data=await result.json();if(!result.ok)throw new Error(data.message||"Upload failed");
 return new Response(JSON.stringify({id:data.documentId,name:file.name,numPages:0,private:true}),{status:200,headers:{"Content-Type":"application/json"}});
}
export const createDocument=async({documentData,folderPathName}:any)=>privateUpload(documentData,undefined,folderPathName);

export const createAgreementDocument = async ({
  documentData,
  teamId,
  numPages,
  folderPathName,
}: {
  documentData: DocumentData;
  teamId: string;
  numPages?: number;
  folderPathName?: string;
}) => {
  // create a document in the database with the blob url
  const response = await fetch(`/api/teams/${teamId}/documents/agreement`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: documentData.name,
      url: documentData.key,
      storageType: documentData.storageType,
      numPages: numPages,
      folderPathName: folderPathName,
      type: documentData.supportedFileType,
      contentType: documentData.contentType,
      fileSize: documentData.fileSize,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response;
};

// create a new version in the database
export const createNewDocumentVersion=async({documentData,documentId}:any)=>privateUpload(documentData,documentId);
