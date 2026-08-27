const { ensureVerifiedMember } = require('../../helpers/verified-member');
const assert = require('node:assert/strict');
const { By } = require('selenium-webdriver');
const { waitForVisible } = require('../../helpers/waits');
const envConfig = require('../../config/env');
const { execSync } = require('child_process');
const path = require('path');

function prepareTestMatchInDb(extraArg = '') {
  const testDir = path.resolve(__dirname, '../../');
  const serverEnv = path.resolve(testDir, '../sztufa-server/.env.e2e');
  const scriptPath = path.resolve(testDir, 'scratch/ensure-match.js');

  const output = execSync(`node --env-file="${serverEnv}" "${scriptPath}" ${extraArg}`, { cwd: testDir, encoding: 'utf-8' });
  const matchLine = output.split('\n').find((l) => l.startsWith('MATCH_ID:'));
  return matchLine ? matchLine.replace('MATCH_ID:', '').trim() : null;
}

async function loginApi(username, password) {
  const res = await fetch(`${envConfig.apiBaseUrl.replace(/\/$/, '')}/api/v1/staff-auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
  assert.ok(res.ok, `${username} API 登录必须成功`);
  return (await res.json()).token;
}

async function ensureStudent() { return ensureVerifiedMember('student_card_e2e', '2026CARDE2E'); }

async function test(options = {}) {
  const driver = options.driver;
  assert.ok(driver, 'Business 用例必须使用统一 runner 注入的 WebDriver');

  try {
    const baseUrl = envConfig.webBaseUrl.replace(/\/$/, '');

    // 1. 确保数据库中具备有效对阵比赛与测试学生账号
    const student = await ensureStudent();
    const matchId = prepareTestMatchInDb();
    assert.ok(matchId, '必须准备就绪可供竞猜的比赛记录');

    // 2. 前台普通学生用户登录 (role: user)
    await driver.get(`${baseUrl}/login`);
    const usernameInput = await waitForVisible(driver, By.css('#username, input[type="text"]'), 8000);
    await usernameInput.sendKeys(student.username);
    const passwordInput = await driver.findElement(By.css('#password, input[type="password"]'));
    await passwordInput.sendKeys(student.password);
    const loginSubmitBtn = await driver.findElement(By.css('button[type="submit"]'));
    await loginSubmitBtn.click();
    await driver.sleep(2500);

    // 3. 访问前台竞猜页面
    await driver.get(`${baseUrl}/predictions`);
    await driver.sleep(1500);

    // 等待竞猜卡片与选择按钮异步渲染完成
    const matchCard = await waitForVisible(driver, By.xpath("//div[contains(@class,'predictionCard')][.//*[contains(normalize-space(.),'E2E竞猜主队')]]"), 12000);
    assert.ok(matchCard, '前台竞猜页面必须正确加载并展示待竞猜的比赛选项卡片');

    // 点击选择胜负选项（如“主胜”或“打平”）并提交竞猜
    const homeWinBtn = await matchCard.findElement(By.xpath(".//button[contains(@class,'choiceBtn')][.//*[contains(.,'主胜')]]"));
    await driver.executeScript("arguments[0].click();", homeWinBtn);
    await driver.wait(async () => (await homeWinBtn.getAttribute('class')).includes('selected'), 8000, '主胜按钮提交后必须进入 selected 状态');

    const studentToken = student.token;
    const myRes = await fetch('http://127.0.0.1:3000/api/v1/predictions/me?limit=100', { headers: { Authorization: `Bearer ${studentToken}` } });
    assert.ok(myRes.ok, '个人竞猜 API 必须响应成功');
    const myData = await myRes.json();
    const savedPrediction = myData.data?.find((p) => p.matchId === matchId || p.match?.id === matchId);
    assert.ok(savedPrediction, '数据库必须持久化 student1 对目标比赛的竞猜');
    assert.equal(savedPrediction.choice, 'HOME_WIN', '持久化竞猜选项必须为 HOME_WIN');

    prepareTestMatchInDb('--finish-home-win');
    const adminToken = await loginApi('admin', 'admin123');
    const settleRes = await fetch(`http://127.0.0.1:3000/api/v1/predictions/matches/${matchId}/recalculate`, { method: 'POST', headers: { Authorization: `Bearer ${adminToken}` } });
    assert.ok(settleRes.ok, `目标比赛竞猜结算必须成功，HTTP ${settleRes.status}`);

    // 4. 访问前台积分排行榜页面
    await driver.get(`${baseUrl}/leaderboard`);
    await driver.sleep(1500);

    const scopeTabs = await driver.findElements(By.css('.scopeTab, button'));
    if (scopeTabs.length >= 2) {
      await scopeTabs[1].click(); // 切换历史总榜
      await driver.sleep(800);
    }

    const leaderboardSource = await driver.getPageSource();
    assert.ok(leaderboardSource.includes('student_card_e2e'), '公开排行榜 DOM 必须展示本次已结算竞猜用户 student1');

    // 5. 后端 API 竞猜与排行榜数据闭环校验
    const leaderboardApiRes = await fetch('http://127.0.0.1:3000/api/v1/predictions/leaderboard?scope=all', { headers: { Authorization: `Bearer ${studentToken}` } });
    assert.ok(leaderboardApiRes.ok, '后端竞猜排行榜 API 接口响应状态必须为 200');
    const leaderboard = await leaderboardApiRes.json();
    const studentRank = leaderboard.list?.find((item) => item.username === 'student_card_e2e');
    assert.ok(studentRank, '排行榜 API 必须包含 student1');
    assert.ok(studentRank.points >= 3 && studentRank.correctCount >= 1, 'student1 猜中主胜后必须获得至少 3 分并计入一次猜中');

    console.log('    ✔ [BIZ-005] 公开站竞猜提交与积分排行榜联动闭环校验通过');
  } finally {}
}

module.exports = {
  id: 'BIZ-005',
  name: '公开站竞猜提交与积分排行榜联动闭环校验',
  suite: 'business',
  run: test,
};
