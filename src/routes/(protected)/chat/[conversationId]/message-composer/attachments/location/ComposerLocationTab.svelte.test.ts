// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { decodeGeohash, encodeGeohash } from "$lib/model/geohash";

const mocks = vi.hoisted(() => ({
	preferences: vi.fn(),
	send: vi.fn(),
	run: vi.fn(),
	suspend: vi.fn(),
	resume: vi.fn(),
	abort: vi.fn(),
	lastFix: { lat: 52.52, lon: 13.405, accuracyMeters: 10 },
	disabled: false,
}));
vi.mock("$lib/app-data/preferences.svelte", () => ({
	preferencesSnapshot: mocks.preferences,
}));
vi.mock("$lib/api/browse/location", () => ({ getPlaces: vi.fn() }));
vi.mock("$lib/location/auto-location", () => ({
	autoLocation: { suspend: mocks.suspend, resume: mocks.resume },
}));
vi.mock("$lib/location/location-request.svelte", () => ({
	locationRequest: {
		abort: mocks.abort,
		lastFix: mocks.lastFix,
		run: mocks.run,
	},
}));
vi.mock("../../message-composer-context.svelte", () => ({
	getMessageComposerContext: () => () => ({
		disabled: mocks.disabled,
		sendMessages: mocks.send,
	}),
}));
vi.mock("$lib/platform/os", () => ({ isMobilePlatform: () => true }));

import ComposerLocationTab from "./ComposerLocationTab.svelte";

await import("$lib/components/location-chooser/GeoMapPicker.svelte");

const geohash = encodeGeohash({ lat: 48.8566, lon: 2.3522 });

beforeEach(() => {
	vi.clearAllMocks();
	mocks.disabled = false;
	mocks.preferences.mockReturnValue({ geohash });
	mocks.send.mockReturnValue(undefined);
	mocks.run.mockResolvedValue({ status: "ok", coords: mocks.lastFix });
});
afterEach(cleanup);

function open() {
	const onClose = vi.fn();
	const onSelectionChange = vi.fn();
	const rendered = render(ComposerLocationTab, {
		onClose,
		onSelectionChange,
	});
	return { ...rendered, onClose, onSelectionChange };
}

describe("location attachment", () => {
	it("defaults to the current main map location with GPS off, even with a cached GPS fix", () => {
		mocks.preferences.mockReturnValue({
			geohash,
			autoUpdateLocation: false,
		});
		const first = open();
		first.component.submitSelection();
		const { lat, lon } = decodeGeohash(geohash);
		expect(mocks.send).toHaveBeenNthCalledWith(1, [
			expect.objectContaining({
				outbound: { type: "Location", body: { lat, lon } },
			}),
		]);
		first.unmount();

		const movedGeohash = encodeGeohash({ lat: 40.4168, lon: -3.7038 });
		mocks.preferences.mockReturnValue({
			geohash: movedGeohash,
			autoUpdateLocation: false,
		});
		open().component.submitSelection();
		const moved = decodeGeohash(movedGeohash);
		expect(mocks.send).toHaveBeenNthCalledWith(2, [
			expect.objectContaining({
				outbound: {
					type: "Location",
					body: { lat: moved.lat, lon: moved.lon },
				},
			}),
		]);
	});

	it("sends the chosen coordinates with an optimistic location message", () => {
		const { component, onClose, onSelectionChange, unmount } = open();
		const { lat, lon } = decodeGeohash(geohash);
		const message = { type: "Location", body: { lat, lon } };
		expect(onSelectionChange).toHaveBeenLastCalledWith({
			count: 1,
			label: "Send location",
		});
		component.submitSelection();
		expect(onClose).toHaveBeenCalledOnce();
		expect(mocks.send).toHaveBeenCalledWith([
			{ outbound: message, optimistic: message },
		]);
		expect(mocks.suspend).toHaveBeenCalledOnce();
		unmount();
		expect(mocks.resume).toHaveBeenCalledOnce();
	});

	it("does not send without a selected point or when messaging is disabled", () => {
		mocks.preferences.mockReturnValue({ geohash: null });
		const first = open();
		first.component.submitSelection();
		expect(first.onSelectionChange).toHaveBeenLastCalledWith({
			count: 0,
			label: "Send location",
		});
		first.unmount();
		mocks.preferences.mockReturnValue({ geohash });
		mocks.disabled = true;
		const second = open();
		second.component.submitSelection();
		expect(mocks.send).not.toHaveBeenCalled();
		expect(second.onClose).not.toHaveBeenCalled();
	});

	it("sends the pin selected through the map's locate button", async () => {
		const { component } = open();
		await fireEvent.click(
			await screen.findByRole("button", { name: "Locate me" }),
		);
		component.submitSelection();
		const message = {
			type: "Location",
			body: { lat: mocks.lastFix.lat, lon: mocks.lastFix.lon },
		};
		expect(mocks.send).toHaveBeenCalledExactlyOnceWith([
			{ outbound: message, optimistic: message },
		]);
	});
});
