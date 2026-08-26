const assert = require('node:assert/strict');
const { assertCoreVisible, layoutMetrics, openLoginAt } = require('../../helpers/compatibility-suite');
async function run({ driver }) { await openLoginAt(driver, 1280, 900); await assertCoreVisible(driver); const m = await layoutMetrics(driver); assert.ok(m.viewportWidth >= 1200); assert.ok(m.documentWidth <= m.viewportWidth + 1, `桌面视口不应横向溢出: ${JSON.stringify(m)}`); }
module.exports = { id: 'COMPAT-001', name: '桌面视口核心登录布局无横向溢出', suite: 'compatibility', run };
