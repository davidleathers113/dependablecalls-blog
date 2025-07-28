
import { test } from '@playwright/test';
import { expect } from '@playwright/test';

test('MobileUXTest_2025-07-25', async ({ page, context }) => {
  
    // Navigate to URL
    await page.goto('http://localhost:5173');

    // Take screenshot
    await page.screenshot({ path: 'iphone-se-homepage-375x667.png', { fullPage: true } });

    // Take screenshot
    await page.screenshot({ path: 'iphone-se-hamburger-visible.png' });

    // Click element
    await page.click('button[aria-label="Toggle mobile menu"]');

    // Take screenshot
    await page.screenshot({ path: 'iphone-se-menu-clicked.png' });

    // Navigate to URL
    await page.goto('http://localhost:5173/login');

    // Take screenshot
    await page.screenshot({ path: 'iphone-se-login-page.png', { fullPage: true } });

    // Click element
    await page.click('input[name="email"]');

    // Fill input field
    await page.fill('input[name="email"]', 'test@example.com');

    // Navigate to URL
    await page.goto('http://localhost:5173');

    // Take screenshot
    await page.screenshot({ path: 'iphone-14-pro-homepage.png', { fullPage: true } });

    // Navigate to URL
    await page.goto('http://localhost:5173');

    // Take screenshot
    await page.screenshot({ path: 'ipad-homepage.png', { fullPage: true } });

    // Navigate to URL
    await page.goto('http://localhost:5173');

    // Take screenshot
    await page.screenshot({ path: 'samsung-galaxy-s22-homepage.png', { fullPage: true } });

    // Navigate to URL
    await page.goto('http://localhost:5173');

    // Take screenshot
    await page.screenshot({ path: 'iphone-se-landscape.png', { fullPage: true } });
});