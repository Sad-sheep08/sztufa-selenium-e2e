const assert = require('node:assert/strict');
const { By } = require('selenium-webdriver');
const { waitForVisible } = require('../../helpers/waits');
const AdminLoginPage = require('../../pages/admin/login.page');
const USERS = require('../../fixtures/users');

async function getScorerToken() {
  const res = await fetch('http://127.0.0.1:3000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERS.matchScorer.username, password: USERS.matchScorer.password }),
  });
  const data = await res.json();
  return data.token;
}

async function fetchTeams(token) {
  const res = await fetch('http://127.0.0.1:3000/api/v1/teams/admin/manage?limit=100', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return await res.json();
}

async function test(options = {}) {
  const driver = options.driver;
  assert.ok(driver, 'Business 用例必须使用统一 runner 注入的 WebDriver');

  try {
    const loginPage = new AdminLoginPage(driver);
    await loginPage.open();
    await loginPage.login(USERS.superAdmin.username, USERS.superAdmin.password);
    await loginPage.waitForNavVisible();

    // 1. 明确导航至球队与球员管理页面 (/schedule)
    await loginPage.navigateTo('/schedule');
    await waitForVisible(driver, By.css('.team-info-page'), 15000);

    // 2. 显式等待赛季筛选下拉框并切换至“全部赛季”以展现物化的球队
    const seasonSelect = await waitForVisible(driver, By.css('select'), 10000);
    const allOption = await seasonSelect.findElement(By.css('option[value="all"]'));
    await allOption.click();
    await driver.sleep(1200);

    // 3. 等待表格行并强制断言：球队列表绝不为 0！
    const targetRow = await waitForVisible(driver, By.xpath("//tbody/tr[.//*[contains(normalize-space(.),'计算机学院足球队')]]"), 10000);
    assert.ok(targetRow, '球队列表必须包含本次物化的计算机学院足球队');

    // 4. 点击查看首支球队详情与球员名单
    const viewBtns = await targetRow.findElements(By.css('.view-btn, button[title="查看详情"]'));
    if (viewBtns.length > 0) {
      await driver.executeScript("arguments[0].click();", viewBtns[0]);
    } else {
      await driver.executeScript("arguments[0].click();", targetRow);
    }
    await driver.sleep(1200);

    const playerTables = await driver.findElements(By.css('.player-table, table, .player-list, .form-section'));
    assert.ok(playerTables.length > 0, '选中球队后界面必须渲染球员名单表格');

    const pageContent = await driver.getPageSource();
    assert.ok(pageContent.includes('李四'), '球员名单 DOM 中必须展示物化球员李四');
    assert.ok(pageContent.includes('20261001'), '球员名单 DOM 中必须展示李四的精确学号 20261001');

    // 5. 后端 API & 数据库球队与球员完整性校验
    const token = await getScorerToken();
    const resData = await fetchTeams(token);
    const teams = Array.isArray(resData) ? resData : resData.data || [];
    const targetTeam = teams.find((t) => t.teamName === '计算机学院足球队');
    assert.ok(targetTeam, '后端 API 必须返回本次审核物化的目标球队');
    assert.ok(targetTeam.players?.some((p) => p.name === '李四' && p.studentId === '20261001'), '管理端目标球队 API 数据必须包含李四 (20261001)');

    console.log('    ✔ [BIZ-003] 球队信息与物化球员名单维护非空闭环校验通过');
  } finally {}
}

module.exports = {
  id: 'BIZ-003',
  name: '球队信息与球员名单维护非空闭环校验',
  suite: 'business',
  run: test,
};
