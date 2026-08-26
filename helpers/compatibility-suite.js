const assert = require('node:assert/strict');
const { By } = require('selenium-webdriver');
const AdminLoginPage = require('../pages/admin/login.page');
const envConfig = require('../config/env');

async function openLoginAt(driver, width, height) {
  if (width <= 500 && typeof driver.sendDevToolsCommand === 'function') {
    await driver.sendDevToolsCommand('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true });
  } else {
    await driver.manage().window().setRect({ width, height, x: 0, y: 0 });
  }
  const page = new AdminLoginPage(driver);
  await page.open();
  return page;
}

async function layoutMetrics(driver) {
  return driver.executeScript(() => ({ viewportWidth: window.innerWidth, viewportHeight: window.innerHeight, documentWidth: document.documentElement.scrollWidth, documentHeight: document.documentElement.scrollHeight, bodyWidth: document.body.scrollWidth }));
}

async function assertCoreVisible(driver) {
  for (const selector of ['.auth-card', '#username', '#password', '.auth-submit-btn']) {
    const element = await driver.findElement(By.css(selector));
    assert.equal(await element.isDisplayed(), true, `${selector} 必须可见`);
  }
}

module.exports = { assertCoreVisible, layoutMetrics, openLoginAt, apiBase: envConfig.apiBaseUrl.replace(/\/$/, '') };
