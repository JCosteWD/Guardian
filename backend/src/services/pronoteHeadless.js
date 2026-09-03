const { chromium } = require('playwright');
const crypto = require('crypto');

const LOGIN_TIMEOUT_MS = 30000;

const selectors = {
  username: [
    '#id_21',
    'input[placeholder*="identifiant" i]',
    'input[name="username"]',
    'input[name="login"]',
    'input[type="text"]',
  ],
  password: [
    '#id_22',
    'input[placeholder*="mot de passe" i]',
    'input[name="password"]',
    'input[type="password"]',
  ],
  submit: [
    '#id_10',
    'button:has-text("Se connecter")',
    'input[type="submit"]',
  ],
};

const firstVisible = async (page, candidates) => {
  for (const selector of candidates) {
    const locator = page.locator(selector).first();
    if (await locator.count() && await locator.isVisible()) return locator;
  }
  return null;
};

const dismissCookieDialog = async (page) => {
  const closeButtons = page.locator('button').filter({ hasText: /^Fermer$/ });
  const count = await closeButtons.count();
  if (count) {
    await closeButtons.last().click({ timeout: 3000 }).catch(() => {});
  }
};

const isAuthenticated = async (page) => {
  const text = (await page.locator('body').innerText()).toLowerCase();
  return !text.includes('votre identifiant ou votre mot de passe est incorrect')
    && !text.includes('connexion')
    && (page.url().includes('mobile.') || text.includes('déconnexion') || text.includes('accueil'));
};

const loginHeadless = async ({ schoolUrl, username, password, account = 'student' }) => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: 'fr-FR',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36',
  });
  const page = await context.newPage();

  try {
    await page.goto(schoolUrl, { waitUntil: 'domcontentloaded', timeout: LOGIN_TIMEOUT_MS });
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await dismissCookieDialog(page);

    const usernameField = await firstVisible(page, selectors.username);
    const passwordField = await firstVisible(page, selectors.password);
    const submit = await firstVisible(page, selectors.submit);
    if (!usernameField || !passwordField || !submit) {
      throw new Error('Formulaire Pronote introuvable dans la page chargée.');
    }

    await usernameField.fill(username);
    await passwordField.fill(password);
    await submit.click({ timeout: 10000 });
    await page.waitForLoadState('networkidle', { timeout: LOGIN_TIMEOUT_MS }).catch(() => {});
    await page.waitForTimeout(1000);

    const bodyText = await page.locator('body').innerText();
    if (/identifiant ou votre mot de passe est incorrect/i.test(bodyText)) {
      throw new Error('Identifiants Pronote incorrects.');
    }
    if (!(await isAuthenticated(page))) {
      throw new Error('Pronote n\'a pas confirmé la connexion. Vérifiez le type de compte et l\'URL.');
    }

    return {
      success: true,
      id: crypto.randomUUID(),
      browser,
      context,
      page,
      account,
      schoolUrl,
      username,
      cookies: await context.cookies(),
      connectedAt: new Date().toISOString(),
    };
  } catch (error) {
    await browser.close();
    return { success: false, message: error.message };
  }
};

const closeSession = async (session) => {
  if (session?.browser) await session.browser.close().catch(() => {});
};

module.exports = { loginHeadless, closeSession };
