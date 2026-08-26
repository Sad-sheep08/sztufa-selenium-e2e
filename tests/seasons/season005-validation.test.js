const assert = require('node:assert/strict');
const { apiRequest, assertSettingsRow, cleanupSeasons, createSeason, loginAdmin, openSettings, snapshotSeasons } = require('../../helpers/season-suite');

async function run({ driver }) {
  const snapshot = await snapshotSeasons();
  try {
    const token = await loginAdmin(); const season = await createSeason(token, '唯一性');
    const duplicate = await apiRequest('/api/v1/seasons', { token, method: 'POST', body: { name: season.name, type: 'LEAGUE' } });
    assert.equal(duplicate.response.status, 400); assert.match(JSON.stringify(duplicate.data), /已存在/);
    const invalid = await apiRequest(`/api/v1/seasons/${season.id}/status`, { token, method: 'PATCH', body: { status: 'deleted' } });
    assert.equal(invalid.response.status, 400);
    await openSettings(driver); await assertSettingsRow(driver, season.name, '活跃中');
  } finally { cleanupSeasons(snapshot); }
}
module.exports = { id: 'SEASON-005', name: '拒绝重复名称与非法状态且保留原始赛季', suite: 'seasons', run };
