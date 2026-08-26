const assert = require('node:assert/strict');
const { createDriver } = require('../../config/webdriver');
const AdminLoginPage = require('../../pages/admin/login.page');
const USERS = require('../../fixtures/users');

async function test(options = {}) {
  const browserName = options.browser || 'chrome';

  for (const [userKey, userInfo] of Object.entries(USERS)) {
    console.log(`    ➜ [PERM-005] 正在校验角色菜单可见性: ${userKey} (${userInfo.username})`);
    const { driver } = await createDriver({ browser: browserName, headed: options.headed });

    try {
      const loginPage = new AdminLoginPage(driver);
      await loginPage.open();
      await loginPage.login(userInfo.username, userInfo.password);
      await loginPage.waitForNavVisible();

      const navLinks = await loginPage.getNavLinks();
      const renderedPaths = navLinks.map((l) => l.pathname);

      // 校验允许访问的菜单在导航栏中出现
      for (const allowedPath of userInfo.allowedRoutes) {
        assert.ok(
          renderedPaths.includes(allowedPath),
          `角色 [${userKey}] 的导航栏应包含路径 '${allowedPath}'，实际包含: ${JSON.stringify(renderedPaths)}`
        );
      }

      // 校验禁止访问的菜单在导航栏中隐去
      for (const forbiddenPath of userInfo.forbiddenRoutes) {
        assert.ok(
          !renderedPaths.includes(forbiddenPath),
          `角色 [${userKey}] 的导航栏不应包含路径 '${forbiddenPath}'，实际包含: ${JSON.stringify(renderedPaths)}`
        );
      }

      console.log(`    ✔ [PERM-005] 角色 ${userKey} 菜单矩阵校验通过`);
    } finally {
      await driver.quit();
    }
  }
}

module.exports = {
  id: 'PERM-005',
  name: '角色权限矩阵菜单可见性校验',
  suite: 'permissions',
  run: test,
};
