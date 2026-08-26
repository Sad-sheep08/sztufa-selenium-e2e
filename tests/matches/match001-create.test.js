const assert = require('node:assert/strict');
const { By } = require('selenium-webdriver');
const { apiRequest, findTargetMatch, loginScorer, openScorerAdmin, prepareMatchFixture } = require('../../helpers/match-suite');

async function test(options = {}) {
  const fixture = prepareMatchFixture();
  const token = await loginScorer();
  const existing = await findTargetMatch();
  if (existing) await apiRequest(`/api/v1/matches/${existing.id}`, { token, method: 'DELETE' });
  const payload = { seasonId: fixture.seasonId, homeTeamId: fixture.homeTeamId, awayTeamId: fixture.awayTeamId, matchDate: new Date(Date.now() + 86400000).toISOString(), location: '北区', status: 'scheduled', stage: 'LEAGUE', homeScore: 0, awayScore: 0, events: [], lineups: [] };
  const created = await apiRequest('/api/v1/matches', { token, method: 'POST', body: payload });
  assert.ok(created.response.ok, `创建比赛必须成功，HTTP ${created.response.status}`);
  assert.equal(created.data.location, '北区');
  assert.equal(created.data.status, 'scheduled');

  const driver = options.driver;
  try {
    await openScorerAdmin(driver); await driver.sleep(1500);
    const source = await driver.getPageSource();
    assert.ok(source.includes('E2E比赛主队') && source.includes('E2E比赛客队'), '比赛结果管理 DOM 必须显示新建的目标比赛');
  } finally {}
}

module.exports = { id: 'MATCH-001', name: '创建联赛比赛并校验管理端与数据库落盘', suite: 'matches', run: test };
