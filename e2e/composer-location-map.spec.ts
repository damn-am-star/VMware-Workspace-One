import { encode } from "@msgpack/msgpack";
import { expect, test } from "@playwright/test";
import sharp from "sharp";

import {
	DEMO_CONVERSATION,
	DEMO_GEOHASH,
	installTauriShim,
} from "./support/app";
import { installPersistentAppData } from "./support/app-data";

test("the location map centers when revealed and stays behind drawer controls after panning", async ({
	page,
}) => {
	test.setTimeout(180_000);
	const tile = await sharp({
		create: { width: 256, height: 256, channels: 3, background: "#ff00ff" },
	})
		.png()
		.toBuffer();
	await page.route("https://tile.openstreetmap.org/**", (route) =>
		route.fulfill({ contentType: "image/png", body: tile }),
	);
	await installTauriShim(page);
	await installPersistentAppData(page);
	await page.addInitScript(
		(preferences) => {
			localStorage.setItem("e2e:appdata:preferences", preferences);
		},
		Buffer.from(encode({ geohash: DEMO_GEOHASH })).toString("base64"),
	);
	await page.goto(DEMO_CONVERSATION);
	await page.getByRole("button", { name: "Add attachment" }).click();
	const location = page.getByRole("tab", { name: "Location", exact: true });
	const map = page.locator(".leaflet-container");
	const marker = map.locator(".leaflet-marker-icon");
	for (let opening = 0; opening < 2; opening++) {
		await location.click();
		await expect(marker).toBeVisible();
		await expect
			.poll(async () => {
				const bounds = (await map.boundingBox())!;
				const pin = (await marker.boundingBox())!;
				return Math.max(
					Math.abs(
						pin.x + pin.width / 2 - bounds.x - bounds.width / 2,
					),
					Math.abs(pin.y + pin.height - bounds.y - bounds.height / 2),
				);
			})
			.toBeLessThan(3);
		if (opening === 0)
			await page.getByRole("tab", { name: "Media", exact: true }).click();
	}
	const bounds = (await map.boundingBox())!;
	const pane = map.locator(".leaflet-map-pane");
	const before = await pane.getAttribute("style");
	await page.mouse.move(bounds.x + bounds.width / 2 + 60, bounds.y + 100);
	await page.mouse.down();
	await page.mouse.move(bounds.x + bounds.width / 2 - 60, bounds.y + 200, {
		steps: 12,
	});
	await page.mouse.up();
	await expect(pane).not.toHaveAttribute("style", before!);
	const send = page.getByRole("button", {
		name: "Send location 1",
		exact: true,
	});
	await send.click({ trial: true });
	const button = (await send.boundingBox())!;
	const pixel = await sharp(await page.screenshot())
		.extract({
			left: Math.round(button.x + 8),
			top: Math.round(button.y + button.height / 2),
			width: 1,
			height: 1,
		})
		.removeAlpha()
		.raw()
		.toBuffer();
	expect(
		[...pixel],
		"map tiles must not paint over the send button",
	).not.toEqual([255, 0, 255]);
	await page.getByRole("tab", { name: "Media", exact: true }).click();
	await expect(map).toBeHidden();
});
