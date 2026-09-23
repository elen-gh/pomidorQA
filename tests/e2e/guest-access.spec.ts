import { expect, test } from "@playwright/test";
import { makeUser, registerUserViaApi, ROUTES, contextTracker } from "../helpers/user-api";
import { BookingPage } from "../pages/booking-page";
import { ProfilePage } from "../pages/profile-page";

test.describe("Гостевой доступ без регистрации", () => {
  
  test.afterEach(async () => {
    await contextTracker.cleanup();
  });

  test("гость видит хоста и его слоты, но бронирование требует входа", async ({
    browser,
    page,
  }) => {
    test.setTimeout(60_000);

    const runId = Date.now();
    const host = makeUser("guest-view-host", runId);
    const skill = `GuestView-${runId}`;
    
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    
    const hostProfile = new ProfilePage(hostPage);
    const hostSlots = new BookingPage(hostPage);
    const guestCatalog = new BookingPage(page);

    await test.step("Хост: заводит навык и свободный слот", async () => {
      await registerUserViaApi(hostPage, hostContext, host);
      await hostProfile.addSkill(skill, "can_help");
      await hostSlots.addSlot(host.slotTime);
    });

    await test.step("Гость находит хоста в каталоге", async () => {
      await page.goto(ROUTES.home, { waitUntil: "commit" });
      await guestCatalog.searchBySkill(skill);
      await expect(guestCatalog.catalogCard.filter({ hasText: host.name })).toBeVisible();
    });

    await test.step("Гость открывает страницу хоста", async () => {
      await guestCatalog.openHostCard(host.name);
    });

    await test.step("На странице видны имя, навык и свободное время хоста", async () => {
      await expect(guestCatalog.personName).toHaveText(host.name);
      await expect(guestCatalog.bookingCalendarTime.first()).toBeVisible();
    });

    await test.step("Гость пытается подтвердить бронирование", async () => {
      await guestCatalog.selectFirstSlot();
      await guestCatalog.confirmBooking();
    });

    await test.step("Вместо брони гость видит требование войти в аккаунт", async () => {
      await expect(guestCatalog.bookingConfirmError).toContainText("Нужно войти в аккаунт PomidorQA");
      await expect(guestCatalog.bookingConfirmSuccess).toHaveCount(0);
    });

    await test.step("Слот остался свободным и хост по-прежнему в каталоге", async () => {
      await page.reload();
      await expect(guestCatalog.bookingCalendarTime.first()).toBeVisible();
      
      await page.goto(ROUTES.home, { waitUntil: "commit" });
      await guestCatalog.searchBySkill(skill);
      await expect(guestCatalog.catalogCard.filter({ hasText: host.name })).toBeVisible();
    });
  });

  test("приватные страницы перенаправляют гостя на вход", async ({ page }) => {
    const privatePaths = ["/pomidorqa/profile", "/pomidorqa/profile/slots", "/pomidorqa/bookings"];

    for (const path of privatePaths) {
      await test.step(`Гость открывает ${path}`, async () => {
        await page.goto(path);
      });

      await test.step(`${path} отдаёт страницу входа`, async () => {
        await expect(page).toHaveURL(/\/pomidorqa\/auth\/login/);
      });
    }
  });
});
