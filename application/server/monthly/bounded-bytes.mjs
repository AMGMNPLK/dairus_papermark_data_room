// Bound the bytes actually read, not just the storage server's optional header.
// These are private development reads; this does not establish source provenance.
export const MAX_MONTHLY_FILE_BYTES = 20 * 1024 * 1024;
export class MonthlyFileSizeError extends Error {}

export async function readMonthlyFileBytes(body, contentLength) {
  if (!body || typeof body.transformToWebStream !== 'function') {
    throw new MonthlyFileSizeError('File body unavailable');
  }
  const reader = body.transformToWebStream().getReader();
  const parts = [];
  let total = 0;
  try {
    if (Number(contentLength) > MAX_MONTHLY_FILE_BYTES) {
      throw new MonthlyFileSizeError('File exceeds size limit');
    }
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_MONTHLY_FILE_BYTES) {
        throw new MonthlyFileSizeError('File exceeds size limit');
      }
      parts.push(Buffer.from(value));
    }
    return Buffer.concat(parts, total);
  } catch (error) {
    // Do not leave a network response open after an oversize or failed read.
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
}
