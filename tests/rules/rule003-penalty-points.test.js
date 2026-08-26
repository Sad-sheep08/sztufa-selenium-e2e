const assert = require('node:assert/strict');
const { assertRulesDom, cleanupRuleFixture, computeStandings, loginAdmin, prepareRuleFixture } = require('../../helpers/rule-suite');
async function run({ driver }) { const f = prepareRuleFixture('penalty'); try { const s = await computeStandings(await loginAdmin(), f); assert.equal(s.groups.A[0].teamId, f.teams[0].id); assert.deepEqual(s.groups.A.map((x) => x.points), [2, 0]); assert.deepEqual(s.groups.A.map((x) => x.drawn), [1, 1]); await assertRulesDom(driver, f); } finally { cleanupRuleFixture(); } }
module.exports = { id: 'RULE-003', name: '点球大战胜负按 2/0 分计算', suite: 'rules', run };
