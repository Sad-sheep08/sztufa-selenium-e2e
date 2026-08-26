const assert = require('node:assert/strict');
const { By, Key } = require('selenium-webdriver');
const { waitForVisible } = require('../../helpers/waits');
const AdminLoginPage = require('../../pages/admin/login.page');
const PublicHomePage = require('../../pages/public/home.page');
const USERS = require('../../fixtures/users');

async function setReactInputValue(driver, element, value) {
  await driver.executeScript(`
    const el = arguments[0];
    const val = arguments[1];
    const proto = el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, val);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  `, element, value);
}

async function fetchNewsList() {
  const res = await fetch('http://127.0.0.1:3000/api/v1/news?limit=100');
  return await res.json();
}

async function test(options = {}) {
  const driver = options.driver;
  assert.ok(driver, 'Business 用例必须使用统一 runner 注入的 WebDriver');

  try {
    const loginPage = new AdminLoginPage(driver);
    await loginPage.open();
    await loginPage.login(USERS.newsEditor.username, USERS.newsEditor.password);
    await loginPage.waitForNavVisible();

    // 1. 导航至管理后台活动资讯管理
    await loginPage.navigateTo('/news');
    const newsHeader = await waitForVisible(driver, By.css('.page-header'), 10000);
    assert.ok(newsHeader, '新闻编辑登录后应能打开活动资讯管理页面');

    // 2. 点击“新建资讯”按钮（精确匹配文本，排除“刷新”按钮）
    const createBtn = await waitForVisible(driver, By.xpath("//button[contains(., '新建资讯')]"), 8000);
    await driver.executeScript("arguments[0].click();", createBtn);
    await driver.sleep(800);

    // 3. 填写资讯模态框表单
    await waitForVisible(driver, By.css('input[placeholder*="标题"]'), 5000);

    const testTitle = `【E2E专有新闻】冠军杯决赛倒计时_${Date.now()}`;
    const titleInput = await driver.findElement(By.css('input[placeholder*="标题"]'));
    await setReactInputValue(driver, titleInput, testTitle);

    const dateInput = await driver.findElement(By.css('input[type="date"]'));
    await setReactInputValue(driver, dateInput, '2026-12-31');

    const descInput = await driver.findElement(By.css('textarea'));
    await setReactInputValue(driver, descInput, '这是 Selenium E2E 自动化测试阶段3自动创建的精确专有测试新闻内容。');

    const urlInput = await driver.findElement(By.css('input[type="url"], input[placeholder*="http"]'));
    await setReactInputValue(driver, urlInput, 'https://mp.weixin.qq.com/s/e2e-news-exact-link');

    // 提交保存
    const submitBtn = await driver.findElement(By.css('button[type="submit"]'));
    await driver.executeScript("arguments[0].click();", submitBtn);
    await driver.sleep(2500);

    // 手动点击刷新列表按钮确保获取最新第一页数据
    const refreshBtn = await driver.findElements(By.xpath("//button[contains(., '刷新')]"));
    if (refreshBtn.length > 0) {
      await driver.executeScript("arguments[0].click();", refreshBtn[0]);
      await driver.sleep(1500);
    }

    // 4. 后台管理列表中显式等待或校验精准新闻标题
    const adminPageSource = await driver.getPageSource();
    assert.ok(
      adminPageSource.includes(testTitle),
      `新闻管理后台列表中必须呈现新建的精确新闻标题 '${testTitle}'`
    );

    // 5. 打开公开前台，滚动触发 IntersectionObserver 异步抓取最新新闻 API
    const publicPage = new PublicHomePage(driver);
    await publicPage.open();
    await driver.sleep(1000);

    // 页面滚动触发 Observer 激活
    await driver.executeScript("window.scrollTo(0, 1500);");
    await driver.executeScript("document.getElementById('activities')?.scrollIntoView();");
    await driver.sleep(2500);

    await driver.wait(async () => (await driver.getPageSource()).includes(testTitle), 10000, `公开站首页未渲染精确新闻标题 '${testTitle}'`);

    // 6. 后端 API 接口精准标题落盘校验
    const newsData = await fetchNewsList();
    const createdNewsItem = newsData.data?.find((n) => n.title === testTitle);
    assert.ok(createdNewsItem, `后端 API 接口数据中必须落盘包含精准标题为 '${testTitle}' 的新闻记录`);

    console.log('    ✔ [BIZ-004] 微信新闻发布与公开前台精准标题联动闭环校验通过');
  } finally {}
}

module.exports = {
  id: 'BIZ-004',
  name: '微信新闻发布与公开前台精准标题联动闭环校验',
  suite: 'business',
  run: test,
};
