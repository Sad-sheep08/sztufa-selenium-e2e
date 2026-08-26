const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const envConfig = require('../config/env');
const USERS = require('../fixtures/users');
const AdminLoginPage = require('../pages/admin/login.page');

const apiBase = envConfig.apiBaseUrl.replace(/\/$/, '');

function assertLocalE2E() {
  const host = new URL(apiBase).hostname;
  assert.ok(['localhost', '127.0.0.1', '::1'].includes(host), `seasons 套件会修改数据，只允许本地 E2E API，当前为 ${apiBase}`);
}

async function apiRequest(endpoint, { token, method = 'GET', body } = {}) {
  const response = await fetch(`${apiBase}${endpoint}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  let data = null;
  try { data = await response.json(); } catch {}
  return { response, data };
}

async function loginAdmin() {
  assertLocalE2E();
  const { response, data } = await apiRequest('/api/v1/auth/login', { method: 'POST', body: { username: USERS.superAdmin.username, password: USERS.superAdmin.password } });
  assert.ok(response.ok, `超管 API 登录失败，HTTP ${response.status}`);
  return data.token;
}

async function snapshotSeasons() {
  const { response, data } = await apiRequest('/api/v1/seasons');
  assert.ok(response.ok, '赛季列表 API 必须响应成功');
  return data.map(({ id, status }) => ({ id, status }));
}

function cleanupSeasons(snapshot) {
  const script = path.resolve(__dirname, '../support/seasons/season-fixture.js');
  const envFile = path.resolve(__dirname, '../../sztufa-server/.env.e2e');
  const payload = Buffer.from(JSON.stringify({ seasons: snapshot })).toString('base64url');
  execFileSync(process.execPath, [`--env-file=${envFile}`, script, 'cleanup', payload], { encoding: 'utf8' });
}

async function createSeason(token, suffix, type = 'LEAGUE') {
  const name = `E2E赛季_${suffix}_${Date.now()}`;
  const result = await apiRequest('/api/v1/seasons', { token, method: 'POST', body: { name, type } });
  assert.ok(result.response.ok, `创建赛季失败，HTTP ${result.response.status}`);
  return result.data;
}

async function openSettings(driver) {
  const page = new AdminLoginPage(driver);
  await page.open();
  await page.login(USERS.superAdmin.username, USERS.superAdmin.password);
  await page.waitForNavVisible();
  await page.navigateTo('/settings');
  await driver.sleep(1200);
}

async function assertSettingsRow(driver, name, expectedText) {
  const rows = await driver.findElements({ css: '.season-table tbody tr' });
  for (const row of rows) {
    const text = await row.getText();
    if (text.includes(name)) {
      assert.ok(text.includes(expectedText), `赛季 ${name} 所在行必须显示 ${expectedText}，实际为 ${text}`);
      return;
    }
  }
  assert.fail(`设置页未找到赛季 ${name}`);
}

module.exports = { apiRequest, assertSettingsRow, cleanupSeasons, createSeason, loginAdmin, openSettings, snapshotSeasons };
