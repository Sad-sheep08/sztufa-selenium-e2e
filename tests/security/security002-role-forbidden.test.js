const assert = require('node:assert/strict');
const { By } = require('selenium-webdriver');
const { USERS, assertNoSensitiveLeak, loginApi, openLogin, rawRequest } = require('../../helpers/security-suite');
async function run({ driver }) { const token = await loginApi(USERS.newsEditor); const api = await rawRequest('/api/v1/auth/users', { token }); assert.equal(api.response.status, 403); assertNoSensitiveLeak(api.text); const page = await openLogin(driver); await page.login(USERS.newsEditor.username, USERS.newsEditor.password); await page.waitForNavVisible(); await page.navigateTo('/settings'); const errors = await driver.findElements(By.css('.error-page')); assert.ok(errors.length > 0); assert.ok((await driver.getPageSource()).includes('403')); }
module.exports = { id: 'SEC-002', name: '受限角色无法越权读取超管用户数据', suite: 'security', run };
