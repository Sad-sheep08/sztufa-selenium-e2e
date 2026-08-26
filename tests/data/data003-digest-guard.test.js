const assert = require('node:assert/strict');
const { historyDocument, loginAdmin, openDataTab } = require('../../helpers/data-suite');
const envConfig = require('../../config/env');
async function run({ driver }) { const token = await loginAdmin(); const form = new FormData(); form.append('files', new Blob([JSON.stringify(historyDocument())], { type: 'application/json' }), 'digest.json'); form.append('expectedDigest', '0'.repeat(64)); const response = await fetch(`${envConfig.apiBaseUrl.replace(/\/$/, '')}/api/v1/import/json`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form }); const data = await response.json(); assert.equal(response.status, 400); assert.match(JSON.stringify(data), /摘要|变化|预检/); const source = await openDataTab(driver, '历史 JSON 导入'); assert.ok(source.includes('系统会自动识别赛季')); }
module.exports = { id: 'DATA-003', name: '导入摘要不匹配时阻止事务写入', suite: 'data', run };
