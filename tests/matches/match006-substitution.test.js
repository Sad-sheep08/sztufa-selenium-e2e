const assert = require('node:assert/strict');
const { apiRequest, ensureTargetMatch, loginScorer, openScorerAdmin, prepareMatchFixture } = require('../../helpers/match-suite');
async function test(options = {}) {
  const f = prepareMatchFixture(); const token = await loginScorer(); const match = await ensureTargetMatch(token, f);
  const lineups = [{ playerId: f.homePlayerId, teamType: 'home', lineupType: 'starting' }, { playerId: f.homeSubPlayerId, teamType: 'home', lineupType: 'substitute' }, { playerId: f.awayPlayerId, teamType: 'away', lineupType: 'starting' }];
  const events = [{ eventTime: "55'", eventType: 'substitution', phase: 'REGULAR', teamType: 'home', playerId: f.homeSubPlayerId, playerName: 'E2E比赛主队替补', jerseyNumber: '11', subPlayerId: f.homePlayerId, subPlayerName: 'E2E比赛主队球员', subJerseyNumber: '01', description: '换人' }];
  const res = await apiRequest(`/api/v1/matches/${match.id}`, { token, method: 'PATCH', body: { status: 'ongoing', lineups, events } }); assert.ok(res.response.ok, `换人保存失败 HTTP ${res.response.status}`);
  const detail = (await apiRequest(`/api/v1/matches/${match.id}`)).data;
  assert.ok(detail.events.some((e) => e.eventType === 'substitution' && e.playerId === f.homeSubPlayerId && e.subPlayerId === f.homePlayerId));
  assert.ok(detail.lineups.some((l) => l.playerId === f.homeSubPlayerId && l.lineupType === 'substitute'));
  await openScorerAdmin(options.driver); await options.driver.sleep(1000); assert.ok((await options.driver.getPageSource()).includes('E2E比赛主队'));
}
module.exports = { id: 'MATCH-006', name: '换人事件与首发替补阵容关联校验', suite: 'matches', run: test };
