const assert = require('node:assert/strict');
const { assertRulesDom, cleanupRuleFixture, computeStandings, loginAdmin, prepareRuleFixture } = require('../../helpers/rule-suite');
async function run({ driver }) { const f = prepareRuleFixture('regular'); try { const s = await computeStandings(await loginAdmin(), f); const a = s.groups.A; assert.equal(a[0].teamId, f.teams[0].id); assert.equal(a[0].points, 3); assert.equal(a[0].goalDifference, 2); assert.equal(a[1].points, 0); await assertRulesDom(driver, f); } finally { cleanupRuleFixture(); } }
module.exports = { id: 'RULE-001', name: '常规胜负按 3/0 分计算小组积分', suite: 'rules', run };
