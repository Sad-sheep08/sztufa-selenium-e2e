const { By, Key } = require('selenium-webdriver');
const { waitForVisible, waitForElement, waitForUrlContains } = require('../../helpers/waits');
const envConfig = require('../../config/env');

class AdminLoginPage {
  constructor(driver) {
    this.driver = driver;
    this.baseUrl = envConfig.adminBaseUrl.replace(/\/$/, '');
    this.url = `${this.baseUrl}/login`;

    // Locators based on real React DOM in sztufa-admin
    this.authCard = By.css('.auth-card');
    this.authTitle = By.css('.auth-title');
    this.authSubtitle = By.css('.auth-subtitle');
    this.usernameInput = By.id('username');
    this.passwordInput = By.id('password');
    this.submitBtn = By.css('.auth-submit-btn');
    this.errorAlert = By.css('.auth-alert.auth-alert-error');

    // Navigation & User Status Locators
    this.mainNav = By.css('nav.main-nav');
    this.navUser = By.css('.nav-user');
    this.userName = By.css('.user-name');
    this.logoutBtn = By.css('.logout-btn');
    this.navLinkItems = By.css('.nav-links a');
  }

  async open() {
    await this.driver.get(this.url);
    try {
      await this.driver.executeScript(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
      await this.driver.manage().deleteAllCookies();
      await this.driver.get(this.url);
    } catch {}
    await waitForVisible(this.driver, this.authCard);
  }

  async navigateTo(routePath) {
    const fullUrl = `${this.baseUrl}${routePath.startsWith('/') ? '' : '/'}${routePath}`;
    await this.driver.get(fullUrl);
  }

  async getTitleText() {
    const element = await waitForVisible(this.driver, this.authTitle);
    return await element.getText();
  }

  async getSubtitleText() {
    const element = await waitForVisible(this.driver, this.authSubtitle);
    return await element.getText();
  }

  async isFormVisible() {
    const userInput = await waitForVisible(this.driver, this.usernameInput);
    const passInput = await waitForVisible(this.driver, this.passwordInput);
    const btn = await waitForVisible(this.driver, this.submitBtn);
    return Boolean(userInput && passInput && btn);
  }

  async login(username, password) {
    const userInput = await waitForVisible(this.driver, this.usernameInput);
    await userInput.sendKeys(Key.chord(Key.CONTROL, 'a'), Key.BACK_SPACE, username);

    const passInput = await waitForVisible(this.driver, this.passwordInput);
    await passInput.sendKeys(Key.chord(Key.CONTROL, 'a'), Key.BACK_SPACE, password);

    const btn = await waitForVisible(this.driver, this.submitBtn);
    await this.driver.executeScript("arguments[0].click();", btn);
  }

  async getErrorMessage() {
    const alert = await waitForVisible(this.driver, this.errorAlert);
    return await alert.getText();
  }

  async waitForNavVisible() {
    return await waitForVisible(this.driver, this.mainNav, 8000);
  }

  async getUserInfoText() {
    const element = await waitForVisible(this.driver, this.userName);
    return await element.getText();
  }

  async logout() {
    try {
      const btn = await waitForVisible(this.driver, this.logoutBtn, 3000);
      await btn.click();
      await waitForUrlContains(this.driver, '/login', 3000);
    } catch {}

    try {
      await this.driver.executeScript(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
      await this.driver.manage().deleteAllCookies();
    } catch {}

    await this.driver.get(this.url);
  }

  async getNavLinks() {
    await waitForElement(this.driver, this.navLinkItems);
    const elements = await this.driver.findElements(this.navLinkItems);
    const links = [];
    for (const el of elements) {
      const href = await el.getAttribute('href');
      const text = await el.getText();
      let pathname = '/';
      try {
        const parsed = new URL(href);
        pathname = parsed.pathname;
      } catch {
        pathname = href;
      }
      links.push({ pathname, text });
    }
    return links;
  }
}

module.exports = AdminLoginPage;
