const envConfig = require('../config/env');

async function fetchJson(endpoint, options = {}) {
  const baseUrl = options.baseUrl || envConfig.apiBaseUrl;
  const url = endpoint.startsWith('http') ? endpoint : `${baseUrl.replace(/\/$/, '')}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout || 5000);

  try {
    const res = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });

    const isOk = res.ok;
    const status = res.status;
    let data = null;

    try {
      data = await res.json();
    } catch {
      data = null;
    }

    return { ok: isOk, status, data };
  } catch (err) {
    return { ok: false, status: 0, error: err.message };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function checkApiHealth(apiBaseUrl = envConfig.apiBaseUrl) {
  // 校正说明：后端使用 NestJS，稳定入口为 /api/v1/seasons/active 或 /api/v1/public/summary
  const primaryEndpoint = '/api/v1/seasons/active';
  const fallbackEndpoint = '/api/v1/public/summary';

  const start = Date.now();
  let result = await fetchJson(primaryEndpoint, { baseUrl: apiBaseUrl, timeout: 5000 });

  if (!result.ok) {
    result = await fetchJson(fallbackEndpoint, { baseUrl: apiBaseUrl, timeout: 5000 });
  }

  const responseTimeMs = Date.now() - start;

  return {
    isHealthy: result.ok,
    status: result.status,
    responseTimeMs,
    data: result.data,
    error: result.error,
  };
}

module.exports = {
  fetchJson,
  checkApiHealth,
};
