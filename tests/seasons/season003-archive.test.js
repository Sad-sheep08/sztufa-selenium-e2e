const assert = require('node:assert/strict');
const { apiRequest, assertSettingsRow, cleanupSeasons, loginAdmin, openSettings, snapshotSeasons } = require('../../helpers/season-suite');

async function run({ driver }) {
  const snapshot = await snapshotSeasons();
  try {
    const token = await loginAdmin(); const name = `E2E赛季_归档新建_${Date.now()}`;
    const result = await apiRequest('/api/v1/seasons/archive', { token, method: 'POST', body: { name, type: 'CUP' } });
    assert.ok(result.response.ok); assert.equal(result.data.status, 'active'); assert.equal(result.data.type, 'CUP');
    const active = await apiRequest('/api/v1/seasons/active'); assert.equal(active.data.id, result.data.id);
    const all = await apiRequest('/api/v1/seasons');
    assert.deepEqual(all.data.filter((season) => season.status === 'active').map((season) => season.id), [result.data.id]);
    await openSettings(driver); await assertSettingsRow(driver, name, '杯赛');
  } finally { cleanupSeasons(snapshot); }
}
module.exports = { id: 'SEASON-003', name: '归档往期并创建杯赛且校验唯一最新活跃赛季', suite: 'seasons', run };
