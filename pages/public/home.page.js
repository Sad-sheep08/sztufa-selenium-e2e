const { By } = require('selenium-webdriver');
const { waitForVisible, waitForElement } = require('../../helpers/waits');
const envConfig = require('../../config/env');

class PublicHomePage {
  constructor(driver) {
    this.driver = driver;
    this.url = envConfig.webBaseUrl;

    // Locators based on real React DOM in sztu-fa-web
    this.header = By.css('header.header');
    this.logoTitle = By.css('.logoTitle');
    this.navButtons = By.css('.navLinkBtn');
    this.loginBtn = By.css('.authBtn.loginBtn');
    this.heroSection = By.css('section.hero');
  }

  async open() {
    await this.driver.get(this.url);
    await waitForVisible(this.driver, this.header);
  }

  async getHeaderTitleText() {
    const element = await waitForVisible(this.driver, this.logoTitle);
    return await element.getText();
  }

  async getNavButtons() {
    await waitForElement(this.driver, this.navButtons);
    return await this.driver.findElements(this.navButtons);
  }

  async getNavButtonTexts() {
    const buttons = await this.getNavButtons();
    const texts = [];
    for (const btn of buttons) {
      texts.push(await btn.getText());
    }
    return texts;
  }

  async clickNavButton(text) {
    const buttons = await this.getNavButtons();
    for (const btn of buttons) {
      const btnText = await btn.getText();
      if (btnText.includes(text)) {
        await btn.click();
        return;
      }
    }
    throw new Error(`未在导航中找到文本为 '${text}' 的按钮`);
  }

  async clickLogin() {
    const btn = await waitForVisible(this.driver, this.loginBtn);
    await btn.click();
  }
}

module.exports = PublicHomePage;
