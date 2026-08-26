const assert = require('node:assert/strict');
const AdminLoginPage = require('../../pages/admin/login.page');
const USERS = require('../../fixtures/users');

async function test({ driver }) {
  const loginPage = new AdminLoginPage(driver);
  await loginPage.open();

  await loginPage.login(USERS.superAdmin.username, 'wrong_password_123');

  const errorText = await loginPage.getErrorMessage();
  assert.ok(
    errorText.length > 0,
    '输入错误密码时应在页面呈现错误提示信息'
  );
}

module.exports = {
  id: 'PERM-002',
  name: '错误密码登录失败与错误提示校验',
  suite: 'permissions',
  run: test,
};
