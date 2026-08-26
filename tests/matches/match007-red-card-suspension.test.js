const assert = require('node:assert/strict');
const { apiRequest, ensureTargetMatch, loginScorer, openScorerAdmin, prepareMatchFixture } = require('../../helpers/match-suite');
async function test(options = {}) {
  const f = prepareMatchFixture(); const token = await loginScorer(); const match = await ensureTargetMatch(token, f);
  const events = [{ eventTime: "70'", eventType: 'red_card', phase: 'REGULAR', teamType: 'away', playerId: f.awayPlayerId, playerName: 'E2E比赛客队球员', jerseyNumber: '02', description: '红牌' }];
  const res = await apiRequest(`/api/v1/matches/${match.id}`, { token, method: 'PATCH', body: { status: 'finished', homeScore: 0, awayScore: 0, events } }); assert.ok(res.response.ok, `红牌完赛保存失败 HTTP ${res.response.status}`);
  const teams = (await apiRequest('/api/v1/teams/admin/manage?limit=100', { token })).data.data;
  const player = teams.find((t) => t.id === f.awayTeamId).players.find((p) => p.id === f.awayPlayerId);
  assert.equal(player.status, 'suspended'); assert.ok(player.redCards >= 1); assert.equal(player.suspendedAtMatchId, match.id);
  await openScorerAdmin(options.driver); await options.driver.sleep(1000); assert.ok((await options.driver.getPageSource()).includes('E2E比赛客队'));
}
module.exports = { id: 'MATCH-007', name: '红牌事件与球员自动停赛联动', suite: 'matches', run: test };
