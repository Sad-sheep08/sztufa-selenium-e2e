const assert = require('node:assert/strict');
const { loginAdmin, multipartRequest, openDataTab } = require('../../helpers/data-suite');
async function run({ driver }) { const token = await loginAdmin(); const result = await multipartRequest('/api/v1/import/json/preview', token, 'invalid.json', JSON.stringify({ hello: 'world' })); assert.ok(result.response.ok); assert.equal(result.data.canImport, false); assert.ok(result.data.errors.some((x) => x.includes('不是受支持'))); const source = await openDataTab(driver, '历史 JSON 导入'); assert.ok(source.includes('一次可上传多个')); }
module.exports = { id: 'DATA-002', name: '非法历史 JSON 结构被预检拒绝', suite: 'data', run };
