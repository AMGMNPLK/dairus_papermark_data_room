import { useRouter } from "next/router";

import { useMemo } from "react";

import { UploadIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";

import {
  FREE_PLAN_ACCEPTED_FILE_TYPES,
  FULL_PLAN_ACCEPTED_FILE_TYPES,
  SUPPORTED_DOCUMENT_MIME_TYPES,
} from "@/lib/constants";
import { usePlan } from "@/lib/swr/use-billing";
import useLimits from "@/lib/swr/use-limits";
import { bytesToSize } from "@/lib/utils";
import { fileIcon } from "@/lib/utils/get-file-icon";
import {
  getFileSizeLimit,
  getFileSizeLimits,
} from "@/lib/utils/get-file-size-limits";


export default function DocumentUpload({
  currentFile,
  setCurrentFile,
}: {
  currentFile: File | null;
  setCurrentFile: React.Dispatch<React.SetStateAction<File | null>>;
}) {
  const router = useRouter();
  const { theme, systemTheme } = useTheme();
  const isLight =
    theme === "light" || (theme === "system" && systemTheme === "light");
  const { isFree, isTrial } = usePlan();
  const { limits } = useLimits();

  // Get file size limits
  const fileSizeLimits = useMemo(
    () =>
      getFileSizeLimits({
        limits,
        isFree,
        isTrial,
      }),
    [limits, isFree, isTrial],
  );

  const { getRootProps, getInputProps } = useDropzone({
    accept: {"application/pdf":[".pdf"]},
    maxSize:20*1024*1024,
    multiple:false,
    onDropAccepted:(files)=>{if(files[0])setCurrentFile(files[0]);},
    onDropRejected: (fileRejections) => {
      const { errors, file } = fileRejections[0];
      let message;
      if (errors[0].code === "file-too-large") {
        const fileSizeLimitMB = getFileSizeLimit(file.type, fileSizeLimits);
        message = `File size too big (max. ${fileSizeLimitMB} MB)`;
        if (isFree && !isTrial) {
          toast.error(message, {
            description: "Upgrade to a paid plan to increase the limit",
            action: {
              label: "Upgrade",
              onClick: () => router.push("/settings/upgrade-holiday-offer"),
            },
            duration: 10000,
          });
          return;
        }
      } else if (errors[0].code === "file-invalid-type") {
        const isSupported = SUPPORTED_DOCUMENT_MIME_TYPES.includes(file.type);
        message = "File type not supported";
        if (isFree && !isTrial && isSupported) {
          toast.error(`${message} on free plan`, {
            description: `Upgrade to a paid plan to upload ${file.type} files`,
            action: {
              label: "Upgrade",
              onClick: () => router.push("/settings/upgrade-holiday-offer"),
            },
            duration: 10000,
          });
          return;
        }
      } else {
        message = errors[0].message;
      }
      toast.error(message);
    },
  });

  const imageBlobUrl = useMemo(
    () => (currentFile ? URL.createObjectURL(currentFile) : ""),
    [currentFile],
  );

  return (
    <div className="col-span-full">
      <div
        {...getRootProps()}
        className="group relative block cursor-pointer font-semibold text-foreground hover:bg-gray-100 hover:text-gray-900 hover:dark:bg-gray-900 hover:dark:text-gray-500"
      >
        <input {...getInputProps()} name="file" className="sr-only" />
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-black/25 px-6 py-10 dark:border-white/25 md:min-w-full">
          {currentFile ? (
            <div
              className="pointer-events-none absolute inset-0 opacity-10 transition-opacity group-hover:opacity-5"
              style={{
                backgroundImage: `url(${imageBlobUrl})`,
                backgroundPosition: "center",
                backgroundSize: "cover",
              }}
            />
          ) : null}

          <div className="max-w-md text-center">
            {currentFile ? (
              <div className="flex flex-col items-center text-foreground sm:flex-row sm:space-x-2">
                <div>
                  {fileIcon({
                    fileType: currentFile.type,
                    isLight,
                  })}
                </div>
                <p className="max-w-md truncate">{currentFile.name}</p>
                <p className="text-gray-500">{bytesToSize(currentFile.size)}</p>
              </div>
            ) : (
              <UploadIcon
                className="mx-auto h-10 w-10 text-gray-500"
                aria-hidden="true"
              />
            )}

            <div className="mt-4 flex text-sm leading-6 text-gray-500">
              <span className="mx-auto">
                {currentFile ? "" : "Choose file to upload or drag and drop"}
              </span>
            </div>
            <p className="text-xs leading-5 text-gray-500">
              {currentFile ? "Replace file?" : "PDF · up to 20 MiB and 80 pages · stored privately"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
