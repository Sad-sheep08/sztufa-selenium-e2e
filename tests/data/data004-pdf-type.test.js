const assert = require('node:assert/strict');
const { loginAdmin, multipartRequest, openDataTab } = require('../../helpers/data-suite');
async function run({ driver }) { const token = await loginAdmin(); const result = await multipartRequest('/api/v1/import/pdf/preview', token, 'fake.txt', 'not a pdf', 'file'); assert.equal(result.response.status, 400); assert.match(JSON.stringify(result.data), /只支持上传 .pdf/); const source = await openDataTab(driver, '历史 JSON 导入'); assert.ok(source.includes('历史 JSON')); }
module.exports = { id: 'DATA-004', name: 'PDF 预检拒绝错误文件扩展名', suite: 'data', run };
