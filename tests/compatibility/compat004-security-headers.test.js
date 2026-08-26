const assert = require('node:assert/strict');
const { apiBase, openLoginAt } = require('../../helpers/compatibility-suite');
async function run({ driver }) { const response = await fetch(`${apiBase}/api/v1/seasons`); assert.equal(response.headers.get('x-content-type-options'), 'nosniff'); assert.equal(response.headers.get('x-frame-options'), 'SAMEORIGIN'); assert.match(response.headers.get('content-security-policy') || '', /default-src 'self'/); assert.equal(response.headers.get('referrer-policy'), 'strict-origin-when-cross-origin'); await openLoginAt(driver, 1280, 900); assert.ok((await driver.getPageSource()).includes('校园足球赛事系统')); }
module.exports = { id: 'COMPAT-004', name: 'API Helmet 安全响应头在 Chromium 浏览器环境一致', suite: 'compatibility', run };
