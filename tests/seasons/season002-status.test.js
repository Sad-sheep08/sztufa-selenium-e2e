const assert = require('node:assert/strict');
const { apiRequest, assertSettingsRow, cleanupSeasons, createSeason, loginAdmin, openSettings, snapshotSeasons } = require('../../helpers/season-suite');

async function run({ driver }) {
  const snapshot = await snapshotSeasons();
  try {
    const token = await loginAdmin(); const season = await createSeason(token, '状态');
    const archived = await apiRequest(`/api/v1/seasons/${season.id}/status`, { token, method: 'PATCH', body: { status: 'archived' } });
    assert.ok(archived.response.ok); assert.equal(archived.data.status, 'archived');
    await openSettings(driver); await assertSettingsRow(driver, season.name, '已归档');
  } finally { cleanupSeasons(snapshot); }
}
module.exports = { id: 'SEASON-002', name: '赛季归档状态切换并校验管理端显示', suite: 'seasons', run };
