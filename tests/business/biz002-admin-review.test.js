const assert = require('node:assert/strict');
const { By } = require('selenium-webdriver');
const { waitForVisible } = require('../../helpers/waits');
const AdminLoginPage = require('../../pages/admin/login.page');
const USERS = require('../../fixtures/users');

async function getAdminToken() {
  const res = await fetch('http://127.0.0.1:3000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERS.superAdmin.username, password: USERS.superAdmin.password }),
  });
  const data = await res.json();
  return data.token;
}

async function fetchAdminRegistrations(token) {
  const res = await fetch('http://127.0.0.1:3000/api/v1/registrations/admin', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return await res.json();
}

async function fetchAllTeams(token) {
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

    // 1. 导航至报名审核页面
    await loginPage.navigateTo('/registration-review');
    await waitForVisible(driver, By.css('.registration-container'), 10000);

    // 2. 点击“查看详情”按钮打开审核弹窗
    const targetRow = await waitForVisible(driver, By.xpath("//tr[.//*[contains(normalize-space(.), '计算机学院足球队')]]"), 10000);
    const viewDetailBtn = await targetRow.findElement(By.xpath(".//button[contains(., '查看详情')]"));
    await driver.executeScript("arguments[0].click();", viewDetailBtn);
    await driver.sleep(1000);

    // 3. 填写审核意见并点击“审核通过 (物化数据)”按钮
    const commentTextarea = await waitForVisible(driver, By.css('textarea'), 5000);
    await commentTextarea.sendKeys('E2E 自动化测试审核意见：资料无误，予以审核通过并物化数据。');

    const approveBtn = await driver.findElement(By.css('button.btn-success'));
    assert.ok(approveBtn, '审核详情面板中必须提供“审核通过”按钮');
    
    // 注入 alert 拦截，避免阻塞 Driver 驱动
    await driver.executeScript("window.alert = () => true;");
    await driver.executeScript("arguments[0].click();", approveBtn);
    await driver.sleep(2500);

    // 处理系统 Alert 对话框（若有）
    try {
      const alert = await driver.switchTo().alert();
      await alert.accept();
      await driver.sleep(1000);
    } catch {}

    // 4. UI DOM 校验：列表或详情更新为审核通过
    const pageSource = await driver.getPageSource();
    assert.ok(
      pageSource.includes('审核通过') || pageSource.includes('APPROVED'),
      '管理员审核操作后，界面必须呈现“审核通过”状态'
    );

    // 5. 后端 API & 数据库物化状态严格校验
    const token = await getAdminToken();
    const adminRegs = await fetchAdminRegistrations(token);
    const registrations = adminRegs.items || adminRegs;
    const approvedReg = registrations.find((r) => r.teamName === '计算机学院足球队');
    assert.ok(approvedReg, '后端数据库中必须存在本次目标球队的报名记录');
    assert.equal(approvedReg.status, 'APPROVED', '本次目标球队的报名记录必须为 APPROVED');

    const teams = await fetchAllTeams(token);
    const materializedTeams = Array.isArray(teams) ? teams : teams.data || [];
    const materializedTeam = materializedTeams.find((t) => t.teamName === '计算机学院足球队');
    assert.ok(materializedTeam, '审核通过后必须物化本次目标球队，而非任意历史球队');
    assert.ok(materializedTeam.players?.some((p) => p.name === '李四' && p.studentId === '20261001'), '管理端目标球队数据必须物化李四 (20261001)');

    console.log('    ✔ [BIZ-002] 管理员报名审核通过与数据库球队物化闭环校验通过');
  } finally {}
}

module.exports = {
  id: 'BIZ-002',
  name: '管理员报名审核通过与数据库球队物化闭环校验',
  suite: 'business',
  run: test,
};
