const assert = require('node:assert/strict');
const { waitForUrlContains } = require('../../helpers/waits');
const envConfig = require('../../config/env');

async function test({ driver }) {
  const protectedUrl = `${envConfig.adminBaseUrl.replace(/\/$/, '')}/registration`;
  await driver.get(protectedUrl);

  const isRedirected = await waitForUrlContains(driver, '/login', 5000);
  assert.equal(isRedirected, true, '未登录访问受保护后台路径 /registration 应自动重定向至 /login');
}

module.exports = {
  id: 'SMK-004',
  name: '未登录访问受保护页面重定向验证',
  suite: 'smoke',
  run: test,
};
