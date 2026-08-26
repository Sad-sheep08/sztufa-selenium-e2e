const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { apiRequest, loginAdmin, openSettings } = require('./season-suite');

function prepareRuleFixture(scenario) {
  const script = path.resolve(__dirname, '../support/rules/prepare-fixture.js');
  const envFile = path.resolve(__dirname, '../../sztufa-server/.env.e2e');
  return JSON.parse(execFileSync(process.execPath, [`--env-file=${envFile}`, script, scenario], { encoding: 'utf8' }));
}

function cleanupRuleFixture() {
  const script = path.resolve(__dirname, '../support/rules/prepare-fixture.js');
  const envFile = path.resolve(__dirname, '../../sztufa-server/.env.e2e');
  execFileSync(process.execPath, [`--env-file=${envFile}`, script, 'cleanup'], { encoding: 'utf8' });
}

async function computeStandings(token, fixture) {
  const update = await apiRequest(`/api/v1/seasons/${fixture.seasonId}/groups`, { token, method: 'POST', body: { groups: fixture.groups } });
  assert.ok(update.response.ok, `刷新分组积分失败，HTTP ${update.response.status}`);
  const result = await apiRequest(`/api/v1/seasons/${fixture.seasonId}/standings`);
  assert.ok(result.response.ok, '积分榜 API 必须成功');
  return result.data;
}

async function assertRulesDom(driver, fixture) {
  await openSettings(driver);
  const buttons = await driver.findElements({ xpath: "//button[contains(., '赛季分组配置')]" });
  assert.ok(buttons.length > 0, '设置页必须提供赛季分组配置入口');
  await driver.executeScript('arguments[0].click()', buttons[0]);
  await driver.sleep(500);
  const source = await driver.getPageSource();
  assert.ok(source.includes(fixture.seasonName), '分组页面必须显示当前 E2E 杯赛名称');
  assert.ok(source.includes(fixture.teams[0].teamName), '分组页面必须显示 E2E 参赛球队');
}

module.exports = { apiRequest, assertRulesDom, cleanupRuleFixture, computeStandings, loginAdmin, prepareRuleFixture };
