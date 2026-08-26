const assert = require('node:assert/strict');
const { apiRequest, ensureTargetMatch, findTargetMatch, loginScorer, openScorerAdmin, prepareMatchFixture } = require('../../helpers/match-suite');

async function test(options = {}) {
  const fixture = prepareMatchFixture(); const token = await loginScorer(); const match = await ensureTargetMatch(token, fixture);
  const removed = await apiRequest(`/api/v1/matches/${match.id}`, { token, method: 'DELETE' });
  assert.ok(removed.response.ok, `删除目标比赛失败，HTTP ${removed.response.status}`);
  assert.equal(await findTargetMatch(), undefined, '删除后比赛列表不得再返回目标比赛');
  const detail = await apiRequest(`/api/v1/matches/${match.id}`);
  assert.equal(detail.response.status, 404, '删除后目标比赛详情必须返回 404');

  const driver = options.driver;
  try { await openScorerAdmin(driver); await driver.sleep(1500); assert.ok(!(await driver.getPageSource()).includes('E2E比赛主队'), '删除后管理端 DOM 不得显示目标比赛'); } finally {}
}
module.exports = { id: 'MATCH-005', name: '删除比赛并校验列表与详情一致性', suite: 'matches', run: test };
