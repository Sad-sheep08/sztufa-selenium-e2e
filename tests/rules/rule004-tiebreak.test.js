const assert = require('node:assert/strict');
const { assertRulesDom, cleanupRuleFixture, computeStandings, loginAdmin, prepareRuleFixture } = require('../../helpers/rule-suite');
async function run({ driver }) { const f = prepareRuleFixture('tiebreak'); try { const s = await computeStandings(await loginAdmin(), f); const a = s.groups.A; assert.equal(a[0].points, 3); assert.equal(a[1].points, 3); assert.equal(a[0].goalDifference, a[1].goalDifference); assert.equal(a[0].teamId, f.teams[2].id); assert.equal(a[0].goalsFor, 2); await assertRulesDom(driver, f); } finally { cleanupRuleFixture(); } }
module.exports = { id: 'RULE-004', name: '同积分同净胜球时按进球数排序', suite: 'rules', run };
