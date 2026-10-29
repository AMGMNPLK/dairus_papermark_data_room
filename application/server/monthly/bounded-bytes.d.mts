export const MAX_MONTHLY_FILE_BYTES: number;
export class MonthlyFileSizeError extends Error {}
export function readMonthlyFileBytes(body: any, contentLength?: number): Promise<Buffer>;
