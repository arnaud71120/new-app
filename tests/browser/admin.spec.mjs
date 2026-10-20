import {test,expect} from '@playwright/test';
test('Administration et espace personnel sur mobile',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>sessionStorage.setItem('cyberveille-access','local-runtime-test-owner-token-2026'));
 await page.goto('/');await page.locator('#space-open').click();await expect(page.locator('#space-dialog')).toBeVisible();
 await page.locator('[data-space-tab="watch"]').click();await expect(page.locator('#watch-terms')).toBeVisible();await page.locator('#watch-terms').fill('Defender\nCVE-2026');await page.locator('#watch-save').click();await expect(page.locator('#space-status')).toContainText('synchronisées');
 await page.locator('#space-close').click();await page.locator('#admin-open').click();await expect(page.locator('#admin-content')).toContainText('sources au catalogue');
 await page.locator('[data-admin-tab="operations"]').click();await expect(page.locator('#admin-content')).toContainText('Centre d’incidents');
 await page.locator('[data-admin-tab="profiles"]').click();await expect(page.locator('#social-forecast')).toContainText('4 000');
 await page.screenshot({path:'test-results/admin-mobile.png',fullPage:true});expect(errors).toEqual([]);
});
