const targets = [
  ['API', 'http://127.0.0.1:3000/api/v1/seasons'],
  ['Web', 'http://127.0.0.1:5173'],
  ['Admin', 'http://127.0.0.1:8080/login'],
];
const deadline = Date.now() + Number(process.env.E2E_SERVICE_TIMEOUT_MS || 90000);

async function main() {
  const pending = new Map(targets);
  while (pending.size && Date.now() < deadline) {
    for (const [name, url] of pending) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
        if (response.ok) { console.log(`[Ready] ${name}: ${response.status} ${url}`); pending.delete(name); }
      } catch {}
    }
    if (pending.size) await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  if (pending.size) throw new Error(`服务未在时限内就绪: ${[...pending.keys()].join(', ')}`);
}

main().catch((error) => { console.error(error.message); process.exit(1); });
