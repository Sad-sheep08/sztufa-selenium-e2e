const assert = require('node:assert/strict');
const { checkApiHealth } = require('../../helpers/api-client');
const envConfig = require('../../config/env');

async function test() {
  const health = await checkApiHealth(envConfig.apiBaseUrl);

  assert.equal(
    health.isHealthy,
    true,
    `后端 API 健康检查未通过！状态码: ${health.status}, 错误: ${health.error || '未知'}`
  );

  assert.ok(
    health.responseTimeMs < 5000,
    `后端 API 响应过慢，耗时 ${health.responseTimeMs} ms（预期 < 5000 ms）`
  );
}

module.exports = {
  id: 'SMK-003',
  name: 'API 接口可用性健康检查',
  suite: 'smoke',
  run: test,
};
