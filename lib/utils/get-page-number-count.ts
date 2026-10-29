import { PDFDocument } from "pdf-lib";
export async function getPagesCount(arrayBuffer:ArrayBuffer) {
 if(arrayBuffer.byteLength>20*1024*1024)throw new Error("PDF exceeds 20 MiB");
 const document=await PDFDocument.load(arrayBuffer,{updateMetadata:false});
 const pages=document.getPageCount();if(pages>80)throw new Error("PDF exceeds 80 pages");return pages;
}
export function getSheetsCount(_buffer:ArrayBuffer):number {throw new Error("Export spreadsheets to PDF before uploading on this installation");}
