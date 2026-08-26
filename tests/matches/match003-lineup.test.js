const assert = require('node:assert/strict');
const { apiRequest, ensureTargetMatch, loginScorer, openScorerAdmin, prepareMatchFixture } = require('../../helpers/match-suite');

async function test(options = {}) {
  const fixture = prepareMatchFixture(); const token = await loginScorer(); const match = await ensureTargetMatch(token, fixture);
  const lineups = [{ playerId: fixture.homePlayerId, teamType: 'home', lineupType: 'starting' }, { playerId: fixture.awayPlayerId, teamType: 'away', lineupType: 'starting' }];
  const updated = await apiRequest(`/api/v1/matches/${match.id}`, { token, method: 'PATCH', body: { lineups } });
  assert.ok(updated.response.ok, `保存阵容失败，HTTP ${updated.response.status}`);
  const detail = await apiRequest(`/api/v1/matches/${match.id}`);
  assert.equal(detail.data.lineups.length, 2, '目标比赛必须保存两名首发球员');
  assert.ok(detail.data.lineups.every((item) => item.lineupType === 'starting'));

  const driver = options.driver;
  try { await openScorerAdmin(driver); await driver.sleep(1200); assert.ok((await driver.getPageSource()).includes('E2E比赛主队'), '管理端必须可定位已设置阵容的目标比赛'); } finally {}
}
module.exports = { id: 'MATCH-003', name: '设置主客队首发阵容并校验持久化', suite: 'matches', run: test };
