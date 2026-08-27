const path = require('node:path');
const fs = require('node:fs');
const { redactText } = require('./helpers/redaction');
const { createDriver } = require('./config/webdriver');
const {
  captureFailureArtifacts,
  createRunArtifacts,
  appendRunLog,
  writeMarkdownReport,
} = require('./helpers/artifacts');
const envConfig = require('./config/env');

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    suite: null, // 未指定时若有 testId 则跨套件搜索，否则默认 smoke
    testId: null,
    browsers: [envConfig.browser],
    headed: !envConfig.headless,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--suite' && args[i + 1]) {
      options.suite = args[++i].toLowerCase();
    } else if (arg.startsWith('--suite=')) {
      options.suite = arg.slice(8).toLowerCase();
    } else if ((arg === '--test' || arg === '--case') && args[i + 1]) {
      options.testId = args[++i].trim().toUpperCase();
    } else if (arg.startsWith('--test=')) {
      options.testId = arg.slice(7).trim().toUpperCase();
    } else if (arg.startsWith('--case=')) {
      options.testId = arg.slice(7).trim().toUpperCase();
    } else if (arg === '--browser' && args[i + 1]) {
      options.browsers = args[++i].split(',').map((b) => b.trim().toLowerCase());
    } else if (arg.startsWith('--browser=')) {
      options.browsers = arg.slice(10).split(',').map((b) => b.trim().toLowerCase());
    } else if (arg === '--headed') {
      options.headed = true;
    } else {
      console.error(`[Runner] 错误: 未知命令行参数 '${arg}'`);
      console.error(`  支持参数: --test <id>, --suite <name>, --browser <name>, --headed`);
      process.exit(1);
    }
  }

  if (!options.suite && !options.testId) {
    options.suite = 'smoke';
  }

  return options;
}

function loadTestCases(suite, targetTestId) {
  let testCases = [];
  const testsDir = path.join(__dirname, 'tests');

  const allSuites = [
    'smoke',
    'permissions',
    'business',
    'matches',
    'seasons',
    'rules',
    'data',
    'security',
    'compatibility',
  ];

  const suiteDirs = suite === 'all' || (!suite && targetTestId)
    ? allSuites
    : [suite || 'smoke'];

  for (const dirName of suiteDirs) {
    const dirPath = path.join(testsDir, dirName);
    if (!fs.existsSync(dirPath)) continue;

    const files = fs.readdirSync(dirPath).filter((f) => f.endsWith('.test.js'));
    for (const file of files) {
      const casePath = path.join(dirPath, file);
      try {
        const testCase = require(casePath);
        if (testCase && typeof testCase.run === 'function') {
          testCases.push({
            id: testCase.id || file.replace('.test.js', ''),
            name: testCase.name || file,
            suite: testCase.suite || dirName,
            run: testCase.run,
            requiresBrowser: testCase.requiresBrowser !== false,
          });
        } else {
          throw new Error(`测试模块未导出有效的 run 函数`);
        }
      } catch (err) {
        console.error(`[Runner] 加载测试文件失败 ${file}: ${err.message}`);
        throw err;
      }
    }
  }

  if (targetTestId) {
    testCases = testCases.filter((tc) => tc.id.toUpperCase() === targetTestId);
  }

  return testCases;
}

async function main() {
  const options = parseArgs();
  const startedAt = new Date();
  const suiteLabel = options.testId ? `test:${options.testId}` : options.suite;
  const runArtifacts = createRunArtifacts({
    suite: suiteLabel,
    browsers: options.browsers,
    headed: options.headed,
  });
  console.log(`\n==================================================`);
  console.log(`🚀 SZTUFA Selenium 自动化测试运行器`);
  console.log(`   范围: ${options.testId ? `指定用例 [${options.testId}]` : `套件 [${options.suite}]`}`);
  console.log(`   浏览器: ${options.browsers.join(', ')}`);
  console.log(`   模式: ${options.headed ? '有界面 (--headed)' : '无头 (Headless)'}`);
  console.log(`==================================================\n`);

  const testCases = loadTestCases(options.suite, options.testId);
  if (testCases.length === 0) {
    console.error(`[Runner] 错误: 未找到符合条件的测试用例 (suite=${options.suite}, testId=${options.testId})。`);
    process.exit(1);
  }

  const results = [];
  const startTime = Date.now();
  appendRunLog(runArtifacts, '=== TEST EXECUTION ===');

  for (const browserName of options.browsers) {
    console.log(`\n🌐 正在运行浏览器用例集 [${browserName.toUpperCase()}] ...\n`);

    for (const testCase of testCases) {
      const caseLabel = `[${testCase.id}] ${testCase.name} (${browserName})`;
      process.stdout.write(`  ⏳ 执行中: ${caseLabel} ... `);

      const caseStart = Date.now();
      appendRunLog(runArtifacts, `START ${caseLabel}`);
      let driver = null;
      let pass = false;
      let errorMsg = null;
      let savedArtifacts = null;

      try {
        if (testCase.requiresBrowser) {
          const created = await createDriver({
            browser: browserName,
            headed: options.headed,
          });
          driver = created.driver;
        }

        await testCase.run({ driver, browserName, headed: options.headed });
        pass = true;
        const duration = ((Date.now() - caseStart) / 1000).toFixed(2);
        console.log(`✅ 通过 (${duration}s)`);
        appendRunLog(runArtifacts, `PASS  ${caseLabel} (${duration}s)`);
      } catch (err) {
        pass = false;
        errorMsg = redactText(err.stack || err.message);
        const duration = ((Date.now() - caseStart) / 1000).toFixed(2);
        console.log(`❌ 失败 (${duration}s)`);
        console.error(`     └─ 错误: ${redactText(err.message)}`);
        appendRunLog(runArtifacts, `FAIL  ${caseLabel} (${duration}s)\n${errorMsg}`);

        if (driver) {
          savedArtifacts = await captureFailureArtifacts(driver, `${testCase.id}_${browserName}`, runArtifacts);
          if (savedArtifacts && savedArtifacts.screenshot) {
            console.log(`     └─ 截图: ${savedArtifacts.screenshot}`);
          }
        }
      } finally {
        if (driver) {
          try {
            await driver.quit();
          } catch {}
        }
      }

      results.push({
        id: testCase.id,
        name: testCase.name,
        browser: browserName,
        pass,
        durationMs: Date.now() - caseStart,
        error: errorMsg,
        artifacts: savedArtifacts,
      });
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
  const passedCount = results.filter((r) => r.pass).length;
  const failedCount = results.filter((r) => !r.pass).length;

  console.log(`\n==================================================`);
  console.log(`📊 测试执行报告完成 Summary`);
  console.log(`   总用例数: ${results.length} | 通过: ${passedCount} | 失败: ${failedCount}`);
  console.log(`   总耗时: ${totalTime}s`);
  console.log(`==================================================\n`);

  appendRunLog(runArtifacts, `\nSUMMARY total=${results.length} passed=${passedCount} failed=${failedCount} duration=${totalTime}s`);
  const reportPath = writeMarkdownReport(runArtifacts, {
    suite: options.suite,
    browsers: options.browsers,
    headed: options.headed,
    startedAt,
    finishedAt: new Date(),
    totalTime,
    results,
  });
  console.log(`📝 汇总日志: ${runArtifacts.logPath}`);
  console.log(`📄 测试报告: ${reportPath}`);
  console.log(`📌 最新报告: ${path.join(__dirname, 'artifacts', 'reports', 'LATEST.md')}\n`);

  if (failedCount > 0) {
    console.log(`❌ 失败用例详情:`);
    for (const r of results.filter((r) => !r.pass)) {
      console.log(`  - [${r.id}] ${r.name} (${r.browser})`);
      if (r.error) {
        const firstLine = r.error.split('\n')[0];
        console.log(`    原因: ${firstLine}`);
      }
    }
    console.log(``);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`[Runner] 严重异常:`, redactText(err.stack || err.message));
    process.exit(1);
  });
}

module.exports = { loadTestCases, main };
