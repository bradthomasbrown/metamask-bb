import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { PUBLIC_RPC_URLS } from '../app/scripts/wallet-init/public-rpc';

/** Check the emitted preview as well as real, read-only RPC connectivity. */
async function main() {
  const directory = path.resolve(process.argv[2] ?? 'dist/chrome');
  const files = await readdir(directory, { recursive: true });
  const bundles = await Promise.all(
    files
      .filter((file) => file.endsWith('.js'))
      .map((file) => readFile(path.join(directory, file), 'utf8')),
  );
  await Promise.all(
    Object.entries(PUBLIC_RPC_URLS).map(async ([chainId, url]) => {
      assert(
        bundles.some((bundle) => bundle.includes(url)),
        `Missing ${url} in build`,
      );
      const results = [];
      for (const method of ['eth_chainId', 'eth_blockNumber']) {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: [] }),
          signal: AbortSignal.timeout(20_000),
        });
        assert(response.ok, `${url}: HTTP ${response.status}`);
        const body = (await response.json()) as {
          result?: string;
          error?: unknown;
        };
        assert(!body.error && body.result, `${url}: ${method} failed`);
        assert(
          /^0x[0-9a-f]+$/iu.test(body.result),
          `${url}: invalid ${method}`,
        );
        results.push(body.result);
      }
      assert.equal(BigInt(results[0]), BigInt(chainId), `${url}: wrong chain`);
      assert(BigInt(results[1]) > 0n, `${url}: missing latest block`);
      console.log(`${chainId} ${url}: block ${BigInt(results[1])}`);
    }),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
