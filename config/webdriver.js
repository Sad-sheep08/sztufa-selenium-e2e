const path = require('node:path');
const fs = require('node:fs');
const { Builder, Browser } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const edge = require('selenium-webdriver/edge');
const envConfig = require('./env');

function getChromeDriverPath() {
  return path.join(
    __dirname,
    '..',
    'tools',
    'selenium',
    'chromedriver-win64',
    'chromedriver.exe'
  );
}

async function createDriver(options = {}) {
  const browserName = (options.browser || envConfig.browser).toLowerCase();
  const headed = options.headed !== undefined ? options.headed : !envConfig.headless;

  if (!['chrome', 'edge'].includes(browserName)) {
    throw new Error(`不支持的浏览器类型: ${browserName}，支持值为 'chrome' 或 'edge'`);
  }

  const browser = browserName === 'edge' ? Browser.EDGE : Browser.CHROME;
  const builder = new Builder().forBrowser(browser);

  if (browser === Browser.EDGE) {
    const edgeOptions = new edge.Options();
    edgeOptions.addArguments('--window-size=1280,900');
    edgeOptions.addArguments('--no-sandbox');
    edgeOptions.addArguments('--disable-dev-shm-usage');
    edgeOptions.addArguments('--disable-save-password-bubble');
    edgeOptions.setUserPreferences({
      'credentials_enable_service': false,
      'profile.password_manager_enabled': false,
      'autofill.profile_enabled': false,
    });
    if (!headed) {
      edgeOptions.addArguments('--headless=new');
    }
    builder.setEdgeOptions(edgeOptions);
  } else {
    const chromeOptions = new chrome.Options();
    chromeOptions.addArguments('--window-size=1280,900');
    chromeOptions.addArguments('--no-sandbox');
    chromeOptions.addArguments('--disable-dev-shm-usage');
    chromeOptions.addArguments('--disable-save-password-bubble');
    chromeOptions.setUserPreferences({
      'credentials_enable_service': false,
      'profile.password_manager_enabled': false,
      'autofill.profile_enabled': false,
    });
    chromeOptions.setLoggingPrefs({ browser: 'ALL' });
    if (!headed) {
      chromeOptions.addArguments('--headless=new');
    }

    const localDriverPath = getChromeDriverPath();
    if (fs.existsSync(localDriverPath)) {
      builder.setChromeService(new chrome.ServiceBuilder(localDriverPath));
    }
    builder.setChromeOptions(chromeOptions);
  }

  const driver = await builder.build();

  // 设置隐式等待超时与页面加载超时
  await driver.manage().setTimeouts({
    implicit: 3000,
    pageLoad: envConfig.timeout,
    script: envConfig.timeout,
  });

  return { driver, browserName, headed };
}

module.exports = {
  createDriver,
  getChromeDriverPath,
};
