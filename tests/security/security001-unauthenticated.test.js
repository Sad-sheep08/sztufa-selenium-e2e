const assert = require('node:assert/strict');
const { assertNoSensitiveLeak, openLogin, rawRequest } = require('../../helpers/security-suite');
async function run({ driver }) { const api = await rawRequest('/api/v1/auth/users'); assert.equal(api.response.status, 401); assertNoSensitiveLeak(api.text); const page = await openLogin(driver); await page.navigateTo('/settings'); await driver.sleep(400); assert.ok((await driver.getCurrentUrl()).includes('/login')); }
module.exports = { id: 'SEC-001', name: '未认证访问受保护 API 与页面均被拦截', suite: 'security', run };
