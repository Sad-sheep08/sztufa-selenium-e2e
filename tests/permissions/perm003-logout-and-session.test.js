const assert = require('node:assert/strict');
const AdminLoginPage = require('../../pages/admin/login.page');
const USERS = require('../../fixtures/users');

async function test({ driver }) {
  const loginPage = new AdminLoginPage(driver);
  await loginPage.open();
  await loginPage.login(USERS.superAdmin.username, USERS.superAdmin.password);
  await loginPage.waitForNavVisible();

  await loginPage.logout();

  const currentUrl = await driver.getCurrentUrl();
  assert.ok(currentUrl.includes('/login'), `退出登录后 URL 应返回 /login，实际为: '${currentUrl}'`);

  // 验证 Token 从 localStorage 被清理
  const token = await driver.executeScript(() => localStorage.getItem('token'));
  assert.equal(token, null, '退出登录后 localStorage 中的 token 应被清理');
}

module.exports = {
  id: 'PERM-003',
  name: '退出登录与 Token 会话清理校验',
  suite: 'permissions',
  run: test,
};
