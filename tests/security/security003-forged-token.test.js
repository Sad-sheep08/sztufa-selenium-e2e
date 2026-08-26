const assert = require('node:assert/strict');
const { assertNoSensitiveLeak, openLogin, rawRequest } = require('../../helpers/security-suite');
async function run({ driver }) { const forged = 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJhZG1pbiIsInJvbGUiOiJzdXBlcl9hZG1pbiJ9.invalid'; const api = await rawRequest('/api/v1/auth/me', { token: forged }); assert.equal(api.response.status, 401); assertNoSensitiveLeak(api.text); const page = await openLogin(driver); await driver.executeScript((token) => localStorage.setItem('token', token), forged); await page.navigateTo('/settings'); await driver.sleep(700); assert.ok((await driver.getCurrentUrl()).includes('/login')); }
module.exports = { id: 'SEC-003', name: '伪造 JWT 无法建立 API 或浏览器会话', suite: 'security', run };
