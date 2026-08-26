const assert = require('node:assert/strict');
const AdminLoginPage = require('../../pages/admin/login.page');

async function test({ driver }) {
  const loginPage = new AdminLoginPage(driver);
  await loginPage.navigateTo('/login?expired=true');

  const errorText = await loginPage.getErrorMessage();
  assert.ok(
    errorText.includes('登录已过期') || errorText.includes('重新登录'),
    `访问 /login?expired=true 应呈现过期提示，实际得到: '${errorText}'`
  );
}

module.exports = {
  id: 'PERM-004',
  name: '会话过期 URL 参数与提示页面校验',
  suite: 'permissions',
  run: test,
};
