const assert = require('node:assert/strict');
const { assertSettingsRow, cleanupSeasons, createSeason, loginAdmin, openSettings, snapshotSeasons } = require('../../helpers/season-suite');

async function run({ driver }) {
  const snapshot = await snapshotSeasons();
  try {
    const token = await loginAdmin();
    const season = await createSeason(token, '创建', 'LEAGUE');
    assert.equal(season.status, 'active'); assert.equal(season.type, 'LEAGUE');
    await openSettings(driver); await assertSettingsRow(driver, season.name, '活跃中');
  } finally { cleanupSeasons(snapshot); }
}
module.exports = { id: 'SEASON-001', name: '创建联赛赛季并校验设置页与数据库落盘', suite: 'seasons', run };
