const assert = require('node:assert/strict');
const { apiRequest, loginAdmin, openSettings } = require('./season-suite');
const envConfig = require('../config/env');

const apiBase = envConfig.apiBaseUrl.replace(/\/$/, '');

function historyDocument() {
  const stamp = Date.now();
  return {
    schemaVersion: 2,
    season: { name: `E2E数据预检_${stamp}` },
    teams: [
      { name: `E2E数据甲队_${stamp}`, players: [{ name: '预检球员', jerseyNumbers: ['9'] }] },
      { name: `E2E数据乙队_${stamp}`, players: [] },
    ],
    matches: [{ gameId: `E2E-DATA-${stamp}`, date: '2026年8月26日', time: '18:30', round: '小组赛 A组', group: 'A', homeTeam: `E2E数据甲队_${stamp}`, awayTeam: `E2E数据乙队_${stamp}`, homeScore: 1, awayScore: 0, events: [{ eventId: `event-${stamp}`, time: '12', eventType: '进球', teamType: 'home', teamName: `E2E数据甲队_${stamp}`, playerName: '预检球员', jerseyNumber: '9' }] }],
  };
}

async function multipartRequest(endpoint, token, filename, content, field = 'files') {
  const form = new FormData();
  form.append(field, new Blob([content], { type: filename.endsWith('.pdf') ? 'application/pdf' : 'application/json' }), filename);
  const response = await fetch(`${apiBase}${endpoint}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  let data = null; try { data = await response.json(); } catch {}
  return { response, data };
}

async function openDataTab(driver, label) {
  await openSettings(driver);
  const buttons = await driver.findElements({ xpath: `//button[contains(., '${label}')]` });
  assert.ok(buttons.length > 0, `设置页必须存在 ${label} 页签`);
  await driver.executeScript('arguments[0].click()', buttons[0]);
  await driver.sleep(400);
  return driver.getPageSource();
}

module.exports = { apiRequest, historyDocument, loginAdmin, multipartRequest, openDataTab };
