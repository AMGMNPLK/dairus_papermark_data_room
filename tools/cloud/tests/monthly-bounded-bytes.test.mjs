import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_MONTHLY_FILE_BYTES, MonthlyFileSizeError, readMonthlyFileBytes } from '../../../application/server/monthly/bounded-bytes.mjs';

function body(chunks) {
  let cancelled = false;
  const stream = new ReadableStream({
    pull(controller) {
      if (chunks.length) controller.enqueue(chunks.shift());
      else controller.close();
    },
    cancel() { cancelled = true; },
  }, { highWaterMark: 0 });
  return { transformToWebStream: () => stream, cancelled: () => cancelled };
}

test('reads exact bytes at the limit with no advertised size', async () => {
  const source = body([Buffer.alloc(MAX_MONTHLY_FILE_BYTES, 0x61)]);
  const bytes = await readMonthlyFileBytes(source);
  assert.equal(bytes.length, MAX_MONTHLY_FILE_BYTES);
  assert.equal(bytes[0], 0x61);
  assert.equal(source.cancelled(), false);
});

test('rejects and cancels an oversized response even when its header is missing or misleading', async () => {
  for (const length of [undefined, 1, MAX_MONTHLY_FILE_BYTES + 1]) {
    const source = body([Buffer.alloc(MAX_MONTHLY_FILE_BYTES), Buffer.from('x')]);
    await assert.rejects(readMonthlyFileBytes(source, length), MonthlyFileSizeError);
    assert.equal(source.cancelled(), true);
  }
});

test('rejects a missing body', async () => {
  await assert.rejects(readMonthlyFileBytes(undefined), MonthlyFileSizeError);
});
