const assert = require('node:assert/strict');
const { By, Key } = require('selenium-webdriver');
const { waitForVisible } = require('../../helpers/waits');
const AdminLoginPage = require('../../pages/admin/login.page');
const USERS = require('../../fixtures/users');
const { execSync } = require('child_process');
const path = require('path');

async function setReactInputValue(driver, element, value) {
  await driver.executeScript(`
    const el = arguments[0];
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, arguments[1]);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  `, element, value);
}

function resetCoachRegistrationToDraftInDb() {
  const testDir = path.resolve(__dirname, '../../');
  const serverEnv = path.resolve(testDir, '../sztufa-server/.env.e2e');
  const scriptPath = path.resolve(testDir, 'scratch/reset-registration.js');
  execSync(`node --env-file="${serverEnv}" "${scriptPath}"`, { cwd: testDir, encoding: 'utf-8' });
}

async function getCoachToken() {
  const res = await fetch('http://127.0.0.1:3000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERS.coach.username, password: USERS.coach.password }),
  });
  const data = await res.json();
  return data.token;
}

async function fetchMyRegistration(token) {
  const res = await fetch('http://127.0.0.1:3000/api/v1/registrations/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;
  return await res.json();
}

async function test(options = {}) {
  const driver = options.driver;
  assert.ok(driver, 'Business 用例必须使用统一 runner 注入的 WebDriver');

  try {
    // 0. 数据库重置报名状态为 DRAFT 确保表单为可编辑状态
    resetCoachRegistrationToDraftInDb();

    const loginPage = new AdminLoginPage(driver);
    await loginPage.open();
    await loginPage.login(USERS.coach.username, USERS.coach.password);
    await loginPage.waitForNavVisible();

    // 1. 导航至报名页面
    await loginPage.navigateTo('/registration');
    await waitForVisible(driver, By.css('.registration-container'), 10000);

    // 2. 若尚未创建草稿，点击“开始填报本赛季报名”
    const startBtns = await driver.findElements(By.xpath("//button[contains(text(), '开始填报')]"));
    if (startBtns.length > 0) {
      await driver.executeScript("arguments[0].click();", startBtns[0]);
      await driver.sleep(1000);
    }

    // 3. 严格填写/更新球队基本资料（包含球队名称）
    const teamNameInput = await waitForVisible(driver, By.css('input[placeholder*="队伍名称"], input[placeholder*="球队名称"]'), 8000);
    await teamNameInput.sendKeys(Key.chord(Key.CONTROL, 'a'), Key.BACK_SPACE, '计算机学院足球队');

    const leaderInput = await driver.findElement(By.css('input[placeholder*="领队姓名"]'));
    await leaderInput.sendKeys(Key.chord(Key.CONTROL, 'a'), Key.BACK_SPACE, '张三领队');

    const coachPhoneInput = await driver.findElement(By.css('input[placeholder*="主教练手机号"]'));
    await coachPhoneInput.sendKeys(Key.chord(Key.CONTROL, 'a'), Key.BACK_SPACE, '13800138000');

    const leaderPhoneInput = await driver.findElement(By.css('input[placeholder*="领队手机号"]'));
    await leaderPhoneInput.sendKeys(Key.chord(Key.CONTROL, 'a'), Key.BACK_SPACE, '13900139000');

    const homeJerseyInput = await driver.findElement(By.css('input[placeholder*="主队球衣颜色"]'));
    await homeJerseyInput.sendKeys(Key.chord(Key.CONTROL, 'a'), Key.BACK_SPACE, '红色');

    const awayJerseyInput = await driver.findElement(By.css('input[placeholder*="客队球衣颜色"]'));
    await awayJerseyInput.sendKeys(Key.chord(Key.CONTROL, 'a'), Key.BACK_SPACE, '蓝色');

    // 4. 点击“添加球员”按钮展开输入表单
    const addPlayerBtn = await waitForVisible(driver, By.xpath("//div[contains(@class, 'player-list')]//button[contains(., '添加球员')]"), 8000);
    await driver.executeScript("arguments[0].click();", addPlayerBtn);

    const addPlayerForm = await waitForVisible(driver, By.css('.add-player-form'), 8000);
    const studentIdInput = await addPlayerForm.findElement(By.css('input[placeholder="请输入学号"]'));
    await setReactInputValue(driver, studentIdInput, '20261001');

    const nameInput = await addPlayerForm.findElement(By.css('input[placeholder="请输入球员姓名"]'));
    await setReactInputValue(driver, nameInput, '李四');

    const jerseyNumberInput = await addPlayerForm.findElement(By.css('input[placeholder="请输入球衣号码"]'));
    await setReactInputValue(driver, jerseyNumberInput, '10');

    const confirmPlayerBtn = await addPlayerForm.findElement(By.css('button.submit-btn'));
    await driver.executeScript("arguments[0].click();", confirmPlayerBtn);
    await driver.wait(async () => (await driver.getPageSource()).includes('20261001'), 5000, '添加球员后 DOM 必须展示精确学号');

    // 5. 重写 window.confirm 自动确认并点击“提交报名”按钮
    await driver.executeScript("window.confirm = () => true;");
    const submitBtn = await driver.findElement(By.css('button.btn-success, .registration-action-bar button.btn-success'));
    await driver.executeScript("arguments[0].click();", submitBtn);
    await driver.sleep(2500);

    // 6. UI DOM 断言：状态为已提交
    const statusText = await driver.getPageSource();
    assert.ok(
      statusText.includes('已提交') || statusText.includes('SUBMITTED') || statusText.includes('待审核'),
      '提交报名后，界面必须更新呈现“已提交”或“待审核”状态标识'
    );

    // 7. 后端 API & 数据库持久化状态严格校验
    const token = await getCoachToken();
    const dbReg = await fetchMyRegistration(token);
    assert.ok(dbReg, '后端数据库中必须存在教练提交的报名记录');
    assert.equal(dbReg.status, 'SUBMITTED', '数据库中报名记录状态必须为 SUBMITTED');
    assert.equal(dbReg.teamData?.teamName, '计算机学院足球队', '数据库必须保存本次填写的精确球队名称');
    const savedPlayer = dbReg.players?.find((p) => p.studentId === '20261001');
    assert.ok(savedPlayer, '数据库必须保存学号为 20261001 的报名球员');
    assert.equal(savedPlayer.name, '李四', '数据库中的报名球员姓名必须为李四');
    assert.equal(savedPlayer.jerseyNumber, '10', '数据库中的报名球员号码必须为 10');

    console.log('    ✔ [BIZ-001] 教练填报报名表、添加球员、提交与数据库持久化闭环校验通过');
  } finally {}
}

module.exports = {
  id: 'BIZ-001',
  name: '教练队名与成员报名全流程提交与数据库落盘校验',
  suite: 'business',
  run: test,
};
