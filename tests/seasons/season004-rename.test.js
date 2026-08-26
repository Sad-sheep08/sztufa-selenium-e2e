const assert = require('node:assert/strict');
const { apiRequest, assertSettingsRow, cleanupSeasons, createSeason, loginAdmin, openSettings, snapshotSeasons } = require('../../helpers/season-suite');

async function run({ driver }) {
  const snapshot = await snapshotSeasons();
  try {
    const token = await loginAdmin(); const season = await createSeason(token, '重命名前'); const name = `E2E赛季_重命名后_${Date.now()}`;
    const result = await apiRequest(`/api/v1/seasons/${season.id}`, { token, method: 'PATCH', body: { name } });
    assert.ok(result.response.ok); assert.equal(result.data.name, name);
    await openSettings(driver); await assertSettingsRow(driver, name, '修改名称');
  } finally { cleanupSeasons(snapshot); }
}
module.exports = { id: 'SEASON-004', name: '重命名赛季并校验旧名称被精准替换', suite: 'seasons', run };
