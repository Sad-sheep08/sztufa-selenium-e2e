const assert = require('node:assert/strict');
const { apiRequest, ensureTargetMatch, loginScorer, openScorerAdmin, prepareMatchFixture } = require('../../helpers/match-suite');

async function test(options = {}) {
  const fixture = prepareMatchFixture(); const token = await loginScorer(); const match = await ensureTargetMatch(token, fixture);
  const events = [
    { eventTime: "18'", eventType: 'goal', phase: 'REGULAR', teamType: 'home', playerId: fixture.homePlayerId, playerName: 'E2E比赛主队球员', jerseyNumber: '01', description: '进球' },
    { eventTime: "35'", eventType: 'yellow_card', phase: 'REGULAR', teamType: 'away', playerId: fixture.awayPlayerId, playerName: 'E2E比赛客队球员', jerseyNumber: '02', description: '黄牌' },
  ];
  const updated = await apiRequest(`/api/v1/matches/${match.id}`, { token, method: 'PATCH', body: { status: 'finished', homeScore: 1, awayScore: 0, events } });
  assert.ok(updated.response.ok, `完赛保存失败，HTTP ${updated.response.status}`);
  const detail = await apiRequest(`/api/v1/matches/${match.id}`);
  assert.equal(detail.data.status, 'finished'); assert.equal(detail.data.homeScore, 1); assert.equal(detail.data.awayScore, 0);
  assert.ok(detail.data.events.some((e) => e.eventType === 'goal' && e.playerId === fixture.homePlayerId));
  assert.ok(detail.data.events.some((e) => e.eventType === 'yellow_card' && e.playerId === fixture.awayPlayerId));

  const driver = options.driver;
  try { await openScorerAdmin(driver); await driver.sleep(1500); const source = await driver.getPageSource(); assert.ok(source.includes('E2E比赛主队') && source.includes('1') && source.includes('0'), '管理端 DOM 必须显示目标比赛完赛比分'); } finally {}
}
module.exports = { id: 'MATCH-004', name: '录入进球黄牌并结束比赛', suite: 'matches', run: test };
