const assert = require('node:assert/strict');
const envConfig = require('../config/env');
const USERS = require('../fixtures/users');
const AdminLoginPage = require('../pages/admin/login.page');

const apiBase = envConfig.apiBaseUrl.replace(/\/$/, '');

async function rawRequest(endpoint, { token, method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(`${apiBase}${endpoint}`, { method, headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const text = await response.text();
  let data = null; try { data = JSON.parse(text); } catch {}
  return { response, text, data };
}

async function loginApi(user) {
  const result = await rawRequest('/api/v1/auth/login', { method: 'POST', body: { username: user.username, password: user.password } });
  assert.ok(result.response.ok, `${user.role} API 登录失败`);
  return result.data.token;
}

function assertNoSensitiveLeak(text) {
  assert.doesNotMatch(text, /password\s*[:=]|\$2[aby]\$|PrismaClient|SELECT\s+.+FROM|at\s+.+\.(ts|js):\d+/i, '响应不得泄露密码哈希、SQL、Prisma 或堆栈');
}

async function openLogin(driver) {
  const page = new AdminLoginPage(driver); await page.open(); return page;
}

module.exports = { USERS, apiBase, assertNoSensitiveLeak, loginApi, openLogin, rawRequest };
