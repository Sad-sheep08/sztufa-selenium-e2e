const fs = require('node:fs');
const path = require('node:path');
const { redactText } = require('./redaction');

const ARTIFACTS_DIR = path.join(__dirname, '..', 'artifacts');

function ensureArtifactDirs() {
  const dirs = [
    path.join(ARTIFACTS_DIR, 'screenshots'),
    path.join(ARTIFACTS_DIR, 'html'),
    path.join(ARTIFACTS_DIR, 'logs'),
    path.join(ARTIFACTS_DIR, 'reports'),
  ];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

function createRunArtifacts({ suite, browsers, headed }) {
  ensureArtifactDirs();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runId = `${sanitizeFilename(suite)}_${browsers.map(sanitizeFilename).join('-')}_${timestamp}`;
  const logPath = path.join(ARTIFACTS_DIR, 'logs', `${runId}.log`);
  const reportPath = path.join(ARTIFACTS_DIR, 'reports', `${runId}.md`);
  fs.writeFileSync(logPath, [
    'SZTUFA Selenium consolidated test log',
    `Run ID: ${runId}`,
    `Started: ${new Date().toISOString()}`,
    `Suite: ${suite}`,
    `Browsers: ${browsers.join(', ')}`,
    `Mode: ${headed ? 'headed' : 'headless'}`,
    '',
  ].join('\n'), 'utf8');
  return { runId, logPath, reportPath };
}

function appendRunLog(runArtifacts, text) {
  if (!runArtifacts?.logPath) return;
  fs.appendFileSync(runArtifacts.logPath, `${redactText(text)}\n`, 'utf8');
}

function toRelativeArtifactPath(filePath) {
  if (!filePath) return '';
  return path.relative(path.join(ARTIFACTS_DIR, 'reports'), filePath).replace(/\\/g, '/');
}

function writeMarkdownReport(runArtifacts, summary) {
  const { suite, browsers, headed, startedAt, finishedAt, totalTime, results } = summary;
  const passedCount = results.filter((r) => r.pass).length;
  const failedCount = results.length - passedCount;
  const lines = [
    '# SZTUFA Selenium 测试结果',
    '',
    `- 运行 ID：\`${runArtifacts.runId}\``,
    `- 套件：\`${suite}\``,
    `- 浏览器：${browsers.map((b) => `\`${b}\``).join('、')}`,
    `- 模式：${headed ? 'Headed' : 'Headless'}`,
    `- 开始时间：${startedAt.toISOString()}`,
    `- 结束时间：${finishedAt.toISOString()}`,
    `- 总耗时：${totalTime}s`,
    `- 结果：${failedCount === 0 ? '✅ 通过' : '❌ 失败'}（${passedCount}/${results.length}）`,
    '',
    '## 用例明细',
    '',
    '| 用例 | 浏览器 | 结果 | 耗时 | 失败原因 |',
    '| :--- | :--- | :---: | ---: | :--- |',
  ];
  for (const result of results) {
    const reason = result.error ? result.error.split('\n')[0].replace(/\|/g, '\\|') : '-';
    lines.push(`| ${result.id} ${result.name} | ${result.browser} | ${result.pass ? '✅' : '❌'} | ${(result.durationMs / 1000).toFixed(2)}s | ${reason} |`);
  }
  const failures = results.filter((r) => !r.pass);
  if (failures.length > 0) {
    lines.push('', '## 失败产物', '');
    for (const result of failures) {
      lines.push(`### ${result.id} · ${result.browser}`, '');
      if (result.artifacts?.screenshot) lines.push(`- [截图](${toRelativeArtifactPath(result.artifacts.screenshot)})`);
      if (result.artifacts?.html) lines.push(`- [页面 HTML](${toRelativeArtifactPath(result.artifacts.html)})`);
      lines.push('');
    }
  }
  lines.push('## 汇总日志', '', `- [本次完整日志](${toRelativeArtifactPath(runArtifacts.logPath)})`, '');
  const content = redactText(`${lines.join('\n')}\n`);
  fs.writeFileSync(runArtifacts.reportPath, content, 'utf8');
  fs.writeFileSync(path.join(ARTIFACTS_DIR, 'reports', 'LATEST.md'), content, 'utf8');
  return runArtifacts.reportPath;
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
}

async function captureFailureArtifacts(driver, testName, runArtifacts) {
  if (!driver) return;

  ensureArtifactDirs();

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeName = sanitizeFilename(testName);
  const baseName = `${safeName}-${timestamp}`;

  const savedFiles = {};

  // 敏感流程不落地原始截图/HTML；字符串脱敏无法可靠清除图片和 DOM 中的隐私。
  const sensitive = /BIZ-006|SEC-006/i.test(testName);
  // 1. 截图
  try {
    const screenshotBase64 = sensitive ? null : await driver.takeScreenshot();
    if (screenshotBase64) {
    const screenshotPath = path.join(ARTIFACTS_DIR, 'screenshots', `${baseName}.png`);
    fs.writeFileSync(screenshotPath, Buffer.from(screenshotBase64, 'base64'));
    savedFiles.screenshot = screenshotPath;
    }
  } catch (err) {
    console.error(`[Artifacts] 截图捕获失败: ${err.message}`);
  }

  // 2. 页面 HTML 源码
  try {
    const pageSource = sensitive ? '<!-- 敏感流程：不保存原始页面 -->' : redactText(await driver.getPageSource());
    const htmlPath = path.join(ARTIFACTS_DIR, 'html', `${baseName}.html`);
    fs.writeFileSync(htmlPath, pageSource, 'utf8');
    savedFiles.html = htmlPath;
  } catch (err) {
    console.error(`[Artifacts] HTML 源码捕获失败: ${err.message}`);
  }

  // 3. 浏览器日志与环境上下文
  try {
    let currentUrl = 'unknown';
    let title = 'unknown';
    try {
      currentUrl = await driver.getCurrentUrl();
      title = await driver.getTitle();
    } catch {}

    let logsText = `Test: ${testName}\nTime: ${new Date().toISOString()}\nURL: ${currentUrl}\nTitle: ${title}\n\n`;

    try {
      const logs = await driver.manage().logs().get('browser');
      logsText += '=== BROWSER LOGS ===\n';
      for (const entry of logs) {
        logsText += `[${entry.level.name}] ${entry.timestamp} ${entry.message}\n`;
      }
    } catch {
      logsText += '(Browser logs not supported or unavailable)\n';
    }

    appendRunLog(runArtifacts, `\n=== FAILURE BROWSER CONTEXT: ${testName} ===\n${logsText}`);
    savedFiles.log = runArtifacts?.logPath;
  } catch (err) {
    console.error(`[Artifacts] 日志捕获失败: ${err.message}`);
  }

  return savedFiles;
}

module.exports = {
  redactText,
  captureFailureArtifacts,
  createRunArtifacts,
  appendRunLog,
  writeMarkdownReport,
  ensureArtifactDirs,
};
