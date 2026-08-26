const assert = require('node:assert/strict');
const { apiRequest, ensureTargetMatch, loginScorer, openScorerAdmin, prepareMatchFixture } = require('../../helpers/match-suite');
async function ensureStudent() {
  const register = await apiRequest('/api/v1/auth/student-register', { method: 'POST', body: { username: 'match_student', password: 'match_student123', studentId: 'E2EMATCHUSER' } });
  assert.ok(register.response.ok || register.response.status === 409);
  const login = await apiRequest('/api/v1/auth/login', { method: 'POST', body: { username: 'match_student', password: 'match_student123' } });
  assert.ok(login.response.ok, '竞猜学生登录必须成功'); return login.data.token;
}
async function test(options = {}) {
  const f = prepareMatchFixture(); const scorerToken = await loginScorer(); const match = await ensureTargetMatch(scorerToken, f); const studentToken = await ensureStudent();
  await apiRequest(`/api/v1/matches/${match.id}`, { token: scorerToken, method: 'PATCH', body: { status: 'scheduled', matchDate: new Date(Date.now() + 86400000).toISOString(), homeScore: 0, awayScore: 0, events: [] } });
  const prediction = await apiRequest(`/api/v1/predictions/matches/${match.id}`, { token: studentToken, method: 'PUT', body: { choice: 'HOME_WIN' } }); assert.ok(prediction.response.ok);
  const finish = await apiRequest(`/api/v1/matches/${match.id}`, { token: scorerToken, method: 'PATCH', body: { status: 'finished', homeScore: 1, awayScore: 0, events: [{ eventTime: "10'", eventType: 'goal', phase: 'REGULAR', teamType: 'home', playerId: f.homePlayerId, playerName: 'E2E比赛主队球员', jerseyNumber: '01', description: '进球' }] } }); assert.ok(finish.response.ok);
  const mine = (await apiRequest('/api/v1/predictions/me?limit=100', { token: studentToken })).data.data.find((p) => p.matchId === match.id || p.match?.id === match.id);
  assert.equal(mine.status, 'CORRECT'); assert.equal(mine.awardedPoints, 3);
  const board = (await apiRequest('/api/v1/predictions/leaderboard?scope=all', { token: studentToken })).data;
  assert.ok(board.list.some((u) => u.username === 'match_student' && u.points >= 3));
  await openScorerAdmin(options.driver); await options.driver.sleep(1000); assert.ok((await options.driver.getPageSource()).includes('E2E比赛主队'));
}
module.exports = { id: 'MATCH-009', name: '完赛后竞猜自动结算与排行榜积分联动', suite: 'matches', run: test };
