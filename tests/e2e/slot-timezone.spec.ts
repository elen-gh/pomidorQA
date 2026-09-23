import { expect, test, type BrowserContext } from "@playwright/test";
import { makeUser, registerUserViaApi, contextTracker } from "../helpers/user-api";
import { BookingPage } from "../pages/booking-page";
import { ProfilePage } from "../pages/profile-page";

test.describe("Часовой пояс слотов", () => {
  test.afterEach(async () => {
    await contextTracker.cleanup();
  });

  test("владелец и гость видят одно и то же время слота", async ({ browser, page }) => {
    test.setTimeout(60_000);

    const runId = Date.now();
    const host = makeUser("tz-host", runId);
    const skill = `Timezone-${runId}`;
    
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    
    const hostProfile = new ProfilePage(hostPage);
    const hostSlots = new BookingPage(hostPage);
    const guest = new BookingPage(page);

    await test.step("Хост: добавляет навык и слот на завтра", async () => {
      await registerUserViaApi(hostPage, hostContext, host);
      await hostProfile.goto();
      await hostProfile.addSkill(skill, "can_help");
      await hostSlots.addSlot(host.slotTime);
    });

    await test.step("Хост: в своих слотах видит введённое время", async () => {
      await expect(hostSlots.slotsCard.first()).toBeVisible();
    });

    await test.step("Гость: открывает страницу хоста и раскрывает день", async () => {
      await page.goto("/pomidorqa", { waitUntil: "commit" });
      await guest.searchBySkill(skill);
      await guest.openHostCard(host.name);
      await guest.bookingCalendarDay.first().click();
    });

    await test.step("Гость: видит то же время", async () => {
      await expect(guest.bookingCalendarTime.first()).toContainText(host.slotTime);
    });
  });
});
