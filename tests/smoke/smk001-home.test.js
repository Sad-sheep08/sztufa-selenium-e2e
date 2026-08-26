const assert = require('node:assert/strict');
const PublicHomePage = require('../../pages/public/home.page');

async function test({ driver }) {
  const homePage = new PublicHomePage(driver);
  await homePage.open();

  const titleText = await homePage.getHeaderTitleText();
  assert.ok(titleText.includes('SZTU'), `首页 Header 标题应包含 'SZTU'，实际得到: '${titleText}'`);

  const currentUrl = await driver.getCurrentUrl();
  assert.ok(currentUrl.includes('/'), `URL 应在首页，实际得到: '${currentUrl}'`);
}

module.exports = {
  id: 'SMK-001',
  name: '公开站首页打开验证',
  suite: 'smoke',
  run: test,
};
