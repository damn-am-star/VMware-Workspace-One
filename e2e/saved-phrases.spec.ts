import { expect, test } from "@playwright/test";

import {
	DEMO_CONVERSATION,
	installTauriShim,
	MESSAGE_ROW,
} from "./support/app";
import {
	installPersistentAppData,
	storedPreferences,
} from "./support/app-data";
import { stackSettled } from "./support/page-stack";

const FIRST = "Hey! How’s your day going?";
const SECOND = "Want to grab a coffee sometime?";
const THIRD = "I’ll be there in a few minutes.";
const ROW = '[data-slot="saved-phrase"]';
const PICKER = '[data-slot="drawer-content"]';

test.use({ viewport: { width: 390, height: 844 } });

test("settings order survives restart and the phone picker inserts into a persisted draft", async ({
	page,
}) => {
	test.setTimeout(180_000);
	await installTauriShim(page);
	await installPersistentAppData(page);
	await page.goto("/settings");
	await page
		.getByRole("link", { name: "Saved Phrases" })
		.click({ timeout: 60_000 });
	await expect(page).toHaveURL(/\/settings\/phrases$/);
	await stackSettled(page);
	await expect(
		page.getByRole("navigation").getByText("Saved Phrases"),
	).toBeVisible();
	await expect(page.locator(`${ROW} > p`)).toHaveText([FIRST, SECOND, THIRD]);
	await expect(
		page.locator(ROW).first().getByRole("button", { name: "Move up" }),
	).toBeDisabled();
	await expect(
		page.locator(ROW).last().getByRole("button", { name: "Move down" }),
	).toBeDisabled();
	await page
		.locator(ROW)
		.nth(1)
		.getByRole("button", { name: "Move up" })
		.click();
	await expect(page.locator(`${ROW} > p`)).toHaveText([SECOND, FIRST, THIRD]);
	await expect
		.poll(async () => (await storedPreferences(page))?.savedPhraseOrder)
		.toEqual(["demo-phrase-2", "demo-phrase-1", "demo-phrase-3"]);
	await page.reload();
	await expect(page.locator(`${ROW} > p`)).toHaveText([SECOND, FIRST, THIRD]);

	await page.getByRole("link", { name: "Inbox", exact: true }).click();
	await expect(page).toHaveURL(/\/chat$/);
	await page.locator(`a[href="${DEMO_CONVERSATION}"]`).first().click();
	const input = page.getByPlaceholder("Say something...");
	await expect(input).toBeVisible({ timeout: 60_000 });
	await input.fill("Before replace after");
	await input.evaluate((element: HTMLTextAreaElement) =>
		element.setSelectionRange(7, 14),
	);
	const trigger = page.getByRole("button", {
		name: "Saved phrases",
		exact: true,
	});
	const messagesBefore = await page.locator(MESSAGE_ROW).count();
	await trigger.focus();
	await page.keyboard.press("Enter");
	const picker = page.locator(PICKER);
	await expect(picker).toBeVisible();
	await expect(picker.locator('[data-slot="drawer-body"] button')).toHaveText(
		[SECOND, FIRST, THIRD],
	);
	await expect(
		picker.getByRole("link", { name: "Manage in settings" }),
	).toHaveAttribute("href", "/settings/phrases");
	const box = await picker.boundingBox();
	expect(box!.x).toBeGreaterThanOrEqual(0);
	expect(box!.x + box!.width).toBeLessThanOrEqual(390);
	await expect(picker.locator('[data-slot="drawer-body"]')).toHaveCSS(
		"overflow-y",
		"auto",
	);

	await picker.getByRole("button", { name: SECOND, exact: true }).focus();
	await page.keyboard.press("Enter");
	const expected = `Before ${SECOND} after`;
	await expect(picker).toBeHidden();
	await expect(input).toHaveValue(expected);
	await expect(input).toBeFocused();
	expect(
		await input.evaluate((element: HTMLTextAreaElement) => [
			element.selectionStart,
			element.selectionEnd,
		]),
	).toEqual([7 + SECOND.length, 7 + SECOND.length]);
	await expect(page.locator(MESSAGE_ROW)).toHaveCount(messagesBefore);

	await trigger.click();
	await expect(picker).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(picker).toBeHidden();
	await expect(input).toBeFocused();
	await expect(input).toHaveValue(expected);
	await trigger.click();
	await expect(picker).toBeVisible();
	const handled = await page.evaluate(() => {
		const bridge = window as unknown as {
			__AndroidOnBackGesture: () => boolean;
		};
		return bridge.__AndroidOnBackGesture();
	});
	expect(handled, "system back is consumed by the picker").toBe(false);
	await expect(picker).toBeHidden();
	await expect(page).toHaveURL(new RegExp(`${DEMO_CONVERSATION}$`));
	await expect(input).toHaveValue(expected);

	await page.getByRole("link", { name: "Back to chats" }).click();
	const conversation = page.locator(`a[href="${DEMO_CONVERSATION}"]`).first();
	await expect(
		conversation.locator('[data-slot="item-description"]'),
	).toHaveText(`Draft: ${expected}`);
	await conversation.click();
	await expect(input).toHaveValue(expected);
});

test("adding and deleting phrases reaches the demo API and the picker management link", async ({
	page,
}) => {
	test.setTimeout(180_000);
	await installTauriShim(page);
	await page.goto("/settings/phrases");
	const input = page.getByRole("textbox", { name: "New phrase" });
	await expect(input).toBeVisible({ timeout: 60_000 });
	await input.fill("  \n  ");
	await expect(
		page.getByRole("button", { name: "Add phrase" }),
	).toBeDisabled();
	const text = "A new phrase\nwith another line";
	await input.fill(`  ${text}  `);
	await page.getByRole("button", { name: "Add phrase" }).click();
	await expect(page.locator(ROW)).toHaveCount(4);
	await expect(input).toHaveValue("");
	await expect(page.locator(`${ROW} > p`).last()).toHaveText(text);
	await page.getByRole("link", { name: "Back", exact: true }).click();
	await expect(page).toHaveURL(/\/settings$/);
	await stackSettled(page);
	await page.getByRole("link", { name: "Saved Phrases" }).click();
	await expect(page).toHaveURL(/\/settings\/phrases$/);
	await stackSettled(page);
	await expect(page.locator(`${ROW} > p`).last()).toHaveText(text);
	await page
		.locator(ROW)
		.last()
		.getByRole("button", { name: "Delete", exact: true })
		.click();
	await expect(page.locator(ROW)).toHaveCount(3);
	await page.goto(DEMO_CONVERSATION);
	await page
		.getByRole("button", { name: "Saved phrases", exact: true })
		.click({ timeout: 60_000 });
	const picker = page.locator(PICKER);
	await expect(picker.locator('[data-slot="drawer-body"] button')).toHaveText(
		[FIRST, SECOND, THIRD],
	);
	await picker.getByRole("link", { name: "Manage in settings" }).click();
	await expect(page).toHaveURL(/\/settings\/phrases$/);
	await expect(page.locator(`${ROW} > p`)).toHaveText([FIRST, SECOND, THIRD]);
});
