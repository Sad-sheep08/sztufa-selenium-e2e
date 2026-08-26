const assert = require('node:assert/strict');
const { By } = require('selenium-webdriver');
const { createDriver } = require('../../config/webdriver');
const { waitForVisible } = require('../../helpers/waits');
const AdminLoginPage = require('../../pages/admin/login.page');
const USERS = require('../../fixtures/users');

async function test(options = {}) {
  const browserName = options.browser || 'chrome';

  // 测试非超管角色直接输入 URL 越权访问
  const testRoles = [USERS.coach, USERS.newsEditor, USERS.matchScorer];

  for (const userInfo of testRoles) {
    console.log(`    ➜ [PERM-006] 正在校验越权 URL 拦截: ${userInfo.role} (${userInfo.username})`);
    const { driver } = await createDriver({ browser: browserName, headed: options.headed });

    try {
      const loginPage = new AdminLoginPage(driver);
      await loginPage.open();
      await loginPage.login(userInfo.username, userInfo.password);
      await loginPage.waitForNavVisible();

      for (const forbiddenRoute of userInfo.forbiddenRoutes) {
        await loginPage.navigateTo(forbiddenRoute);

        // 等待 403 错误页面渲染
        const errorPage = await waitForVisible(driver, By.css('.error-page'), 5000);
        assert.ok(errorPage, `角色 [${userInfo.role}] 访问 '${forbiddenRoute}' 应呈现 .error-page`);

        const pageSource = await driver.getPageSource();
        const currentUrl = await driver.getCurrentUrl();

        const isIntercepted =
          currentUrl.includes('/403') ||
          pageSource.includes('403') ||
          pageSource.includes('访问被拒绝') ||
          pageSource.includes('没有权限') ||
          currentUrl.includes('/login');

        assert.ok(
          isIntercepted,
          `角色 [${userInfo.role}] 直接访问未授权 URL '${forbiddenRoute}' 应被拦截（渲染 403 页面），实际 URL: '${currentUrl}'`
        );
      }

      console.log(`    ✔ [PERM-006] 角色 ${userInfo.role} 越权 URL 拦截校验通过`);
    } finally {
      await driver.quit();
    }
  }
}

module.exports = {
  id: 'PERM-006',
  name: '直接输入 URL 越权访问拦截 (403) 校验',
  suite: 'permissions',
  run: test,
};
