import {expect, test} from '@playwright/test';

test('loads docs home and navigates to user manual @e2e', async ({page}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', {name: 'Daily Stock Analysis 文档中心'})).toBeVisible();

  await page.getByRole('link', {name: '进入文档首页'}).click();
  await expect(page).toHaveURL(/\/docs\/intro$/);
  await expect(page.getByRole('heading', {name: 'Daily Stock Analysis 文档中心'})).toBeVisible();

  await page.getByRole('link', {name: 'DSA UI 操作手册'}).first().click();
  await expect(page).toHaveURL(/\/docs\/dsa-ui\/user-manual$/);
  await expect(page.getByRole('heading', {name: 'DSA UI 操作手册'})).toBeVisible();
  await expect(page.getByAltText('桌面端主导航')).toBeVisible();

  await page.getByRole('link', {name: '导航与入口'}).first().click();
  await expect(page).toHaveURL(/\/docs\/dsa-ui\/manual\/navigation$/);
  await expect(page.getByRole('heading', {name: '导航与入口'})).toBeVisible();
});

test('navigation sidebar includes dsa-ui docs @e2e', async ({page}) => {
  await page.goto('/docs/intro');
  await expect(page.getByRole('link', {name: 'DSA UI 重构方案'})).toBeVisible();
  await expect(page.getByRole('link', {name: 'DSA UI 开发计划'})).toBeVisible();
  await expect(page.getByRole('link', {name: 'DSA UI 任务跟踪'})).toBeVisible();
});
