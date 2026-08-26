const assert = require('node:assert/strict');
const { createDriver } = require('../../config/webdriver');
const AdminLoginPage = require('../../pages/admin/login.page');
const USERS = require('../../fixtures/users');

async function test(options = {}) {
  const browserName = options.browser || 'chrome';

  for (const [userKey, userInfo] of Object.entries(USERS)) {
    console.log(`    ➜ [PERM-001] 正在测试角色: ${userKey} (${userInfo.username})`);
    const { driver } = await createDriver({ browser: browserName, headed: options.headed });

    try {
      const loginPage = new AdminLoginPage(driver);
      await loginPage.open();
      await loginPage.login(userInfo.username, userInfo.password);
      await loginPage.waitForNavVisible();

      const userInfoText = await loginPage.getUserInfoText();
      assert.ok(
        userInfoText.includes(userInfo.username),
        `角色 [${userKey}] 登录后用户名应为 ${userInfo.username}，实际得到: '${userInfoText}'`
      );
      assert.ok(
        userInfoText.includes(userInfo.roleBadgeText),
        `角色 [${userKey}] 登录后角色标识应包含 '${userInfo.roleBadgeText}'，实际得到: '${userInfoText}'`
      );

      console.log(`    ✔ [PERM-001] 角色 ${userKey} 测试通过`);
    } finally {
      await driver.quit();
    }
  }
}

module.exports = {
  id: 'PERM-001',
  name: '四类角色登录成功与身份标识显示校验',
  suite: 'permissions',
  run: test,
};
