const { ensureVerifiedMember } = require('../../helpers/verified-member');
const assert = require('node:assert/strict');
const { By } = require('selenium-webdriver');
const { apiRequest, ensureTargetMatch, loginScorer, openScorerAdmin, prepareMatchFixture } = require('../../helpers/match-suite');
async function loginStudent() { return (await ensureVerifiedMember('match_student_card', 'E2ECARDMATCH')).token; }
async function test(options = {}) {
  const f = prepareMatchFixture(); const scorerToken = await loginScorer(); const match = await ensureTargetMatch(scorerToken, f); const studentToken = await loginStudent();
  await apiRequest(`/api/v1/matches/${match.id}`, { token: scorerToken, method: 'PATCH', body: { status: 'scheduled', matchDate: new Date(Date.now() + 86400000).toISOString(), homeScore: 0, awayScore: 0, events: [] } });
  const pred = await apiRequest(`/api/v1/predictions/matches/${match.id}`, { token: studentToken, method: 'PUT', body: { choice: 'DRAW' } }); assert.ok(pred.response.ok);
  const cancelled = await apiRequest(`/api/v1/matches/${match.id}`, { token: scorerToken, method: 'PATCH', body: { status: 'cancelled' } }); assert.ok(cancelled.response.ok);
  const detail = await apiRequest(`/api/v1/matches/${match.id}`); assert.equal(detail.data.status, 'cancelled');
  const mine = (await apiRequest('/api/v1/predictions/me?limit=100', { token: studentToken })).data.data.find((p) => p.matchId === match.id || p.match?.id === match.id);
  assert.equal(mine.status, 'VOID'); assert.equal(mine.awardedPoints, 0);
  await openScorerAdmin(options.driver); await options.driver.sleep(1000); const row = await options.driver.findElement(By.xpath("//tr[.//*[contains(normalize-space(.),'E2E比赛主队')]]")); const rowText = await row.getText(); assert.ok(rowText.includes('已取消'), '目标取消比赛必须在管理端精确显示“已取消”状态');
}
module.exports = { id: 'MATCH-010', name: '取消比赛与竞猜自动作废一致性', suite: 'matches', run: test };
