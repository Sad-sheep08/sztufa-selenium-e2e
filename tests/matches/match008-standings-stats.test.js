const assert = require('node:assert/strict');
const { apiRequest, ensureTargetMatch, loginScorer, openScorerAdmin, prepareMatchFixture } = require('../../helpers/match-suite');
async function test(options = {}) {
  const f = prepareMatchFixture(); const token = await loginScorer(); const match = await ensureTargetMatch(token, f);
  const events = [{ eventTime: "20'", eventType: 'goal', phase: 'REGULAR', teamType: 'home', playerId: f.homePlayerId, playerName: 'E2E比赛主队球员', jerseyNumber: '01', description: '进球' }];
  const res = await apiRequest(`/api/v1/matches/${match.id}`, { token, method: 'PATCH', body: { status: 'finished', homeScore: 1, awayScore: 0, events } }); assert.ok(res.response.ok);
  const standings = await apiRequest(`/api/v1/seasons/${f.seasonId}/standings`); const stats = await apiRequest(`/api/v1/seasons/${f.seasonId}/stats`);
  assert.ok(standings.response.ok && stats.response.ok, '积分榜与赛季统计 API 必须成功');
  assert.ok(JSON.stringify(standings.data).includes('E2E比赛主队'), '积分榜必须包含获胜主队');
  assert.ok(JSON.stringify(stats.data).includes('E2E比赛主队球员'), '射手统计必须包含进球球员');
  await openScorerAdmin(options.driver); await options.driver.sleep(1200); const source = await options.driver.getPageSource(); assert.ok(source.includes('E2E比赛主队') && source.includes('1'));
}
module.exports = { id: 'MATCH-008', name: '完赛结果与积分榜射手统计联动', suite: 'matches', run: test };
