// Independent single-store configuration for the AGPL core preparation.
// Modified 2026-10-08. No commercial storage helper is included here.
export type StorageConfig = {
  region: string;
  endpoint?: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  distributionHost?: string;
  advancedDistributionHost?: string;
  distributionKeyId?: string;
  distributionKeyContents?: string;
  advancedBucket: string;
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing storage setting: ${name}`);
  return value;
}

export function getStorageConfig(_storageRegion?: string): StorageConfig {
  if (process.env.NEXT_PUBLIC_UPLOAD_TRANSPORT !== "s3") {
    throw new Error("Only private S3 storage is configured for this build");
  }
  const endpoint = process.env.NEXT_PRIVATE_UPLOAD_ENDPOINT?.trim();
  if (endpoint) {
    const url = new URL(endpoint);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw new Error("Invalid private S3 endpoint");
    }
  }
  const bucket = required("NEXT_PRIVATE_UPLOAD_BUCKET");
  return {
    region: required("NEXT_PRIVATE_UPLOAD_REGION"),
    endpoint,
    bucket,
    accessKeyId: required("NEXT_PRIVATE_UPLOAD_ACCESS_KEY_ID"),
    secretAccessKey: required("NEXT_PRIVATE_UPLOAD_SECRET_ACCESS_KEY"),
    // This initial core build does not configure CloudFront or a separate spreadsheet store.
    advancedBucket: bucket,
  };
}

export async function getTeamStorageConfigById(
  teamId: string,
): Promise<StorageConfig> {
  if (!teamId)
    throw new Error("A team is required for private document storage");
  // Membership is checked by each caller; this resolver never grants team access.
  return getStorageConfig();
}
