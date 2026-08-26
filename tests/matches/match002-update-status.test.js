const assert = require('node:assert/strict');
const { apiRequest, ensureTargetMatch, loginScorer, openScorerAdmin, prepareMatchFixture } = require('../../helpers/match-suite');

async function test(options = {}) {
  const fixture = prepareMatchFixture(); const token = await loginScorer(); const match = await ensureTargetMatch(token, fixture);
  const updated = await apiRequest(`/api/v1/matches/${match.id}`, { token, method: 'PATCH', body: { location: '南区', status: 'ongoing', matchDate: new Date(Date.now() + 7200000).toISOString() } });
  assert.ok(updated.response.ok, `更新比赛失败，HTTP ${updated.response.status}`);
  assert.equal(updated.data.location, '南区'); assert.equal(updated.data.status, 'ongoing');
  const detail = await apiRequest(`/api/v1/matches/${match.id}`);
  assert.equal(detail.data.location, '南区'); assert.equal(detail.data.status, 'ongoing');

  const driver = options.driver;
  try { await openScorerAdmin(driver); await driver.sleep(1500); const source = await driver.getPageSource(); assert.ok(source.includes('E2E比赛主队') && (source.includes('进行中') || source.includes('ongoing')), 'DOM 必须显示目标比赛进行中状态'); } finally {}
}
module.exports = { id: 'MATCH-002', name: '编辑比赛时间场地与进行中状态', suite: 'matches', run: test };
