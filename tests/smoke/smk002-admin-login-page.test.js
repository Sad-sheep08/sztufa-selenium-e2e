const assert = require('node:assert/strict');
const AdminLoginPage = require('../../pages/admin/login.page');

async function test({ driver }) {
  const loginPage = new AdminLoginPage(driver);
  await loginPage.open();

  const titleText = await loginPage.getTitleText();
  assert.ok(
    titleText.includes('校园足球') || titleText.includes('系统') || titleText.includes('SZTU'),
    `管理后台标题不符合预期，实际得到: '${titleText}'`
  );

  const formVisible = await loginPage.isFormVisible();
  assert.equal(formVisible, true, '管理后台登录表单（用户名、密码输入框及提交按钮）应完全可见');
}

module.exports = {
  id: 'SMK-002',
  name: '管理后台登录页呈现验证',
  suite: 'smoke',
  run: test,
};
