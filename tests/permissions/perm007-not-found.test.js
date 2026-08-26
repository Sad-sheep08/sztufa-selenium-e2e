const assert = require('node:assert/strict');
const AdminLoginPage = require('../../pages/admin/login.page');
const USERS = require('../../fixtures/users');

async function test({ driver }) {
  const loginPage = new AdminLoginPage(driver);
  await loginPage.open();
  await loginPage.login(USERS.superAdmin.username, USERS.superAdmin.password);
  await loginPage.waitForNavVisible();

  await loginPage.navigateTo('/some-invalid-route-999');

  const pageSource = await driver.getPageSource();
  const currentUrl = await driver.getCurrentUrl();

  const isNotFound =
    currentUrl.includes('/404') ||
    pageSource.includes('404') ||
    pageSource.includes('页面不存在') ||
    pageSource.includes('未找到');

  assert.ok(
    isNotFound,
    `访问不存在的路由 '/some-invalid-route-999' 应展示 404 页面，实际 URL: '${currentUrl}'`
  );
}

module.exports = {
  id: 'PERM-007',
  name: '不存在路由访问 404 页面呈现校验',
  suite: 'permissions',
  run: test,
};
