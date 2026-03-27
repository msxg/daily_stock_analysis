import {expect, test} from '@playwright/test';

async function stabilizeForSnapshot(page: import('@playwright/test').Page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        transition: none !important;
        animation: none !important;
        caret-color: transparent !important;
      }
    `,
  });
}

test('home page visual baseline @visual', async ({page}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', {name: 'Daily Stock Analysis 文档中心'})).toBeVisible();
  await stabilizeForSnapshot(page);
  await expect(page).toHaveScreenshot('home-page.png');
});

test('user manual visual baseline @visual', async ({page}) => {
  await page.goto('/docs/dsa-ui/user-manual');
  await expect(page.getByRole('heading', {name: 'DSA UI 操作手册'})).toBeVisible();
  await stabilizeForSnapshot(page);
  await expect(page).toHaveScreenshot('user-manual-top.png');
});
