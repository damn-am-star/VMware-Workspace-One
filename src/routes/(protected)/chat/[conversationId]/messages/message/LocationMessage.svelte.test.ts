// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";

const { openExternalLink } = vi.hoisted(() => ({ openExternalLink: vi.fn() }));
vi.mock("$lib/platform/link-opener", () => ({ openExternalLink }));

import { apiResponseMessageSchema } from "$lib/model/messaging/messages";
import Message from "./Message.svelte";

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe("location messages", () => {
	it.each([false, true])(
		"renders a location with isOut=%s and opens its exact coordinates",
		async (isOut) => {
			const { container } = render(Message, {
				props: {
					message: apiResponseMessageSchema.parse({
						type: "Location",
						messageId: "location-1",
						conversationId: "1:2",
						senderId: isOut ? 1 : 2,
						timestamp: 1_700_000_000_000,
						body: { lat: 51.507456, lon: -0.127812 },
					}),
					isOut,
					isRead: null,
					indexInStack: 0,
					stackLength: 1,
				},
			});

			expect(screen.getByText("Location")).toBeTruthy();
			expect(screen.getByText("51.50746, -0.12781")).toBeTruthy();
			expect(
				container
					.querySelector('[data-slot="message-bubble"]')
					?.classList.contains(
						isOut
							? "bg-message-bubble-out"
							: "bg-message-bubble-in",
					),
			).toBe(true);
			const link = screen.getByRole("link", { name: "Open map" });
			const url =
				"https://www.google.com/maps/search/?api=1&query=51.507456%2C-0.127812";
			expect(link.getAttribute("href")).toBe(url);
			await fireEvent.click(link);
			expect(openExternalLink).toHaveBeenCalledExactlyOnceWith(url);
		},
	);
});
