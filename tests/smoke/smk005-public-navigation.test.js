const assert = require('node:assert/strict');
const PublicHomePage = require('../../pages/public/home.page');

async function test({ driver }) {
  const homePage = new PublicHomePage(driver);
  await homePage.open();

  const navTexts = await homePage.getNavButtonTexts();
  assert.ok(navTexts.length >= 3, `公开站 Header 导航按钮数量应 >= 3，实际得到 ${navTexts.length} 个`);

  // 尝试点击竞猜大厅或登录按钮
  await homePage.clickLogin();

  const currentUrl = await driver.getCurrentUrl();
  assert.ok(currentUrl.includes('/login'), `点击登录按钮后 URL 应跳转至 /login，实际得到: '${currentUrl}'`);
}

module.exports = {
  id: 'SMK-005',
  name: '公开站导航与跳转可用性验证',
  suite: 'smoke',
  run: test,
};
