const { until, By } = require('selenium-webdriver');
const envConfig = require('../config/env');

async function waitForElement(driver, locator, timeoutMs = envConfig.timeout) {
  const by = typeof locator === 'string' ? By.css(locator) : locator;
  return await driver.wait(until.elementLocated(by), timeoutMs);
}

async function waitForVisible(driver, locator, timeoutMs = envConfig.timeout) {
  const by = typeof locator === 'string' ? By.css(locator) : locator;
  return await driver.wait(async () => {
    try {
      const el = await driver.findElement(by);
      if (await el.isDisplayed()) {
        return el;
      }
    } catch {
      return false;
    }
    return false;
  }, timeoutMs, `Waiting for element to be visible ${locator}`);
}

async function waitForText(driver, locator, expectedText, timeoutMs = envConfig.timeout) {
  const element = await waitForElement(driver, locator, timeoutMs);
  await driver.wait(until.elementTextIs(element, expectedText), timeoutMs);
  return element;
}

async function waitForUrlContains(driver, urlSubstring, timeoutMs = envConfig.timeout) {
  return await driver.wait(until.urlContains(urlSubstring), timeoutMs);
}

module.exports = {
  waitForElement,
  waitForVisible,
  waitForText,
  waitForUrlContains,
};
