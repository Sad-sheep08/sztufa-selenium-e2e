const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const envConfig = require('../config/env');
const USERS = require('../fixtures/users');
const AdminLoginPage = require('../pages/admin/login.page');

const apiBase = envConfig.apiBaseUrl.replace(/\/$/, '');

function assertLocalE2E() {
  const host = new URL(apiBase).hostname;
  assert.ok(['localhost', '127.0.0.1', '::1'].includes(host), `matches 套件会修改数据，只允许本地 E2E API，当前为 ${apiBase}`);
}

function prepareMatchFixture() {
  assertLocalE2E();
  const script = path.resolve(__dirname, '../support/matches/prepare-fixture.js');
  const envFile = path.resolve(__dirname, '../../sztufa-server/.env.e2e');
  const output = execFileSync(process.execPath, [`--env-file=${envFile}`, script], { encoding: 'utf8' });
  return JSON.parse(output);
}

async function loginScorer() {
  const response = await fetch(`${apiBase}/api/v1/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: USERS.matchScorer.username, password: USERS.matchScorer.password }) });
  assert.ok(response.ok, `记录员 API 登录失败，HTTP ${response.status}`);
  return (await response.json()).token;
}

async function apiRequest(endpoint, { token, method = 'GET', body } = {}) {
  const response = await fetch(`${apiBase}${endpoint}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  let data = null;
  try { data = await response.json(); } catch {}
  return { response, data };
}

async function findTargetMatch() {
  const { response, data } = await apiRequest('/api/v1/matches?limit=100');
  assert.ok(response.ok, '比赛列表 API 必须响应成功');
  return data.data?.find((m) => m.homeTeam?.teamName === 'E2E比赛主队' && m.awayTeam?.teamName === 'E2E比赛客队');
}

async function ensureTargetMatch(token, fixture) {
  let match = await findTargetMatch();
  if (match) return match;
  const { response, data } = await apiRequest('/api/v1/matches', { token, method: 'POST', body: { seasonId: fixture.seasonId, homeTeamId: fixture.homeTeamId, awayTeamId: fixture.awayTeamId, matchDate: new Date(Date.now() + 86400000).toISOString(), location: '北区', status: 'scheduled', stage: 'LEAGUE', homeScore: 0, awayScore: 0, events: [], lineups: [] } });
  assert.ok(response.ok, `创建目标比赛失败，HTTP ${response.status}`);
  return data;
}

async function openScorerAdmin(driver, route = '/statistics') {
  const page = new AdminLoginPage(driver);
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await page.open();
      await page.login(USERS.matchScorer.username, USERS.matchScorer.password);
      await page.waitForNavVisible();
      await page.navigateTo(route);
      return page;
    } catch (error) {
      if (attempt === 2) throw error;
      await driver.sleep(750);
    }
  }
}

module.exports = { apiRequest, ensureTargetMatch, findTargetMatch, loginScorer, openScorerAdmin, prepareMatchFixture };
