# End-to-End Test Patterns

# Test File Organization
```
e2e/
├── auth/          # Authentication flows
├── campaigns/     # Campaign management
├── calls/         # Call tracking
├── billing/       # Payment processing
└── shared/        # Shared utilities and fixtures
```

# Playwright Configuration
- Multi-browser testing (Chromium, Firefox, Safari)
- Mobile viewport testing
- Network conditions simulation
- Video recording on failures
- Screenshot comparison

# Basic Test Template
```ts
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Setup before each test
    await page.goto('/');
  });

  test('should perform user action', async ({ page }) => {
    // Test implementation
    await page.click('[data-testid="button"]');
    await expect(page.locator('[data-testid="result"]')).toBeVisible();
  });
});
```

# Authentication Flow Tests
```ts
import { test, expect } from '@playwright/test';
import { loginAsSupplier, loginAsBuyer } from './helpers/auth';

test.describe('Authentication', () => {
  test('should login as supplier', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('[name="email"]', 'supplier@test.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('[type="submit"]');
    
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('[data-testid="supplier-dashboard"]')).toBeVisible();
  });

  test('should redirect to login for protected routes', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/login');
  });
});
```

# Page Object Pattern
```ts
// pages/LoginPage.ts
export class LoginPage {
  constructor(private page: Page) {}

  async navigate() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.page.fill('[name="email"]', email);
    await this.page.fill('[name="password"]', password);
    await this.page.click('[type="submit"]');
  }

  async getErrorMessage() {
    return await this.page.textContent('[data-testid="error-message"]');
  }
}

// Usage in test
test('should show error for invalid credentials', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.navigate();
  await loginPage.login('invalid@test.com', 'wrongpassword');
  
  const error = await loginPage.getErrorMessage();
  expect(error).toBe('Invalid credentials');
});
```

# Data Attributes for Testing
```tsx
// Use data-testid for reliable element selection
<button data-testid="create-campaign-button">
  Create Campaign
</button>

// Access in tests
await page.click('[data-testid="create-campaign-button"]');
```

# API Mocking and Fixtures
```ts
import { test, expect } from '@playwright/test';

test('should handle API responses', async ({ page }) => {
  // Mock API response
  await page.route('/api/campaigns', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        campaigns: [
          { id: '1', name: 'Test Campaign', status: 'active' }
        ]
      })
    });
  });

  await page.goto('/campaigns');
  await expect(page.locator('[data-testid="campaign-1"]')).toBeVisible();
});
```

# Real-time Feature Testing
```ts
test('should update call status in real-time', async ({ page, context }) => {
  await page.goto('/calls');
  
  // Simulate real-time update
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('callStatusUpdate', {
      detail: { callId: '123', status: 'completed' }
    }));
  });
  
  await expect(page.locator('[data-testid="call-123-status"]'))
    .toContainText('completed');
});
```

# Multi-User Testing
```ts
test('should handle multiple users simultaneously', async ({ browser }) => {
  const supplierContext = await browser.newContext();
  const buyerContext = await browser.newContext();
  
  const supplierPage = await supplierContext.newPage();
  const buyerPage = await buyerContext.newPage();
  
  // Login as different users
  await loginAsSupplier(supplierPage);
  await loginAsBuyer(buyerPage);
  
  // Test interactions between users
  await supplierPage.click('[data-testid="start-call"]');
  await expect(buyerPage.locator('[data-testid="incoming-call"]'))
    .toBeVisible({ timeout: 5000 });
});
```

# Form Testing
```ts
test('should validate form inputs', async ({ page }) => {
  await page.goto('/campaigns/create');
  
  // Test required field validation
  await page.click('[type="submit"]');
  await expect(page.locator('[data-testid="name-error"]'))
    .toContainText('Campaign name is required');
  
  // Test successful form submission
  await page.fill('[name="name"]', 'New Campaign');
  await page.selectOption('[name="category"]', 'insurance');
  await page.fill('[name="budget"]', '1000');
  
  await page.click('[type="submit"]');
  await expect(page).toHaveURL('/campaigns');
});
```

# Mobile Responsiveness Testing
```ts
test.describe('Mobile Tests', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('should be mobile responsive', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Check mobile navigation
    await page.click('[data-testid="mobile-menu-button"]');
    await expect(page.locator('[data-testid="mobile-nav"]')).toBeVisible();
  });
});
```

# Performance Testing
```ts
test('should load page within acceptable time', async ({ page }) => {
  const startTime = Date.now();
  
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  
  const loadTime = Date.now() - startTime;
  expect(loadTime).toBeLessThan(3000); // 3 second threshold
});
```

# Visual Regression Testing
```ts
test('should match visual snapshot', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  
  await expect(page).toHaveScreenshot('dashboard.png');
});
```

# Error Handling Tests
```ts
test('should handle network errors gracefully', async ({ page }) => {
  // Simulate network failure
  await page.route('/api/**', (route) => {
    route.abort('failed');
  });
  
  await page.goto('/dashboard');
  await expect(page.locator('[data-testid="error-message"]'))
    .toContainText('Unable to load data');
});
```

# DCE-Specific E2E Scenarios

## Supplier Journey
```ts
test('supplier complete journey', async ({ page }) => {
  await loginAsSupplier(page);
  
  // Browse available campaigns
  await page.goto('/campaigns');
  await page.click('[data-testid="campaign-1-select"]');
  
  // Generate tracking number
  await page.click('[data-testid="get-tracking-number"]');
  const trackingNumber = await page.textContent('[data-testid="tracking-number"]');
  
  // Simulate call completion
  await page.click('[data-testid="mark-call-complete"]');
  
  // Check payout calculation
  await expect(page.locator('[data-testid="payout-amount"]'))
    .toContainText('$');
});
```

## Buyer Journey
```ts
test('buyer complete journey', async ({ page }) => {
  await loginAsBuyer(page);
  
  // Create new campaign
  await page.goto('/campaigns/create');
  await page.fill('[name="name"]', 'Insurance Campaign');
  await page.selectOption('[name="vertical"]', 'insurance');
  await page.fill('[name="target_cpa"]', '50');
  await page.click('[type="submit"]');
  
  // Monitor campaign performance
  await page.goto('/campaigns');
  await page.click('[data-testid="campaign-analytics"]');
  
  await expect(page.locator('[data-testid="call-volume"]')).toBeVisible();
  await expect(page.locator('[data-testid="conversion-rate"]')).toBeVisible();
});
```

# Test Data Management
```ts
// fixtures/campaigns.ts
export const testCampaign = {
  name: 'Test Campaign',
  vertical: 'insurance',
  target_cpa: 50,
  daily_budget: 1000,
};

// Use in tests
import { testCampaign } from '../fixtures/campaigns';

test('should create campaign', async ({ page }) => {
  await fillCampaignForm(page, testCampaign);
});
```

# Accessibility Testing
```ts
import { injectAxe, checkA11y } from 'axe-playwright';

test('should be accessible', async ({ page }) => {
  await page.goto('/dashboard');
  await injectAxe(page);
  await checkA11y(page);
});
```

# CRITICAL RULES
- NO regex in E2E test code
- USE data-testid attributes for element selection
- ALWAYS wait for elements to be ready
- TEST real user scenarios end-to-end
- MOCK external APIs appropriately
- TEST across multiple browsers and devices
- VERIFY accessibility compliance
- CHECK performance thresholds
- CLEAN up test data after runs
- USE page object pattern for complex workflows