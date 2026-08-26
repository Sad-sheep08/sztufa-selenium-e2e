const assert = require('node:assert/strict');
const { assertCoreVisible, layoutMetrics, openLoginAt } = require('../../helpers/compatibility-suite');
async function run({ driver }) { await openLoginAt(driver, 390, 844); await assertCoreVisible(driver); const m = await layoutMetrics(driver); assert.ok(m.viewportWidth <= 500); assert.ok(m.documentWidth <= m.viewportWidth + 1, `移动视口不应横向溢出: ${JSON.stringify(m)}`); const cardWidth = await driver.executeScript(() => document.querySelector('.auth-card').getBoundingClientRect().width); assert.ok(cardWidth <= m.viewportWidth); }
module.exports = { id: 'COMPAT-002', name: '390px 移动视口表单完整可见且无横向溢出', suite: 'compatibility', run };
