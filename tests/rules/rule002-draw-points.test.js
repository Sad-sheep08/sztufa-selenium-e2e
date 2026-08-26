const assert = require('node:assert/strict');
const { assertRulesDom, cleanupRuleFixture, computeStandings, loginAdmin, prepareRuleFixture } = require('../../helpers/rule-suite');
async function run({ driver }) { const f = prepareRuleFixture('draw'); try { const s = await computeStandings(await loginAdmin(), f); assert.deepEqual(s.groups.A.map((x) => x.points), [1, 1]); assert.deepEqual(s.groups.A.map((x) => x.drawn), [1, 1]); await assertRulesDom(driver, f); } finally { cleanupRuleFixture(); } }
module.exports = { id: 'RULE-002', name: '普通平局双方各得 1 分', suite: 'rules', run };
