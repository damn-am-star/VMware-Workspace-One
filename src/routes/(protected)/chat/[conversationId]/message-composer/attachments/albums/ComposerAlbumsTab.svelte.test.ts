// @vitest-environment jsdom

import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { tick } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
	getMyAlbums: vi.fn(),
	getAlbumShares: vi.fn(),
	shareAlbum: vi.fn(),
	unshareAlbum: vi.fn(),
}));
const toastError = vi.hoisted(() => vi.fn());
const preferences = vi.hoisted(() => ({
	preferencesSnapshot: vi.fn(),
	setPreferences: vi.fn(),
}));

vi.mock("$lib/api/messaging/albums", () => api);
vi.mock("$lib/app-data/preferences.svelte", () => preferences);
vi.mock("svelte-sonner", () => ({ toast: { error: toastError } }));
vi.mock("../../../conversation-state.svelte", () => ({
	getConversationState: () => () => ({ profile: { profileId: PEER } }),
}));

import { albumShares } from "$lib/chat/album-shares.svelte";
import { demoMyAlbums } from "$lib/demo/mock/albums";
import type { AlbumExpirationType } from "$lib/model/messaging/albums";
import type { TabSelection } from "../tabs";
import ComposerAlbumsTab from "./ComposerAlbumsTab.svelte";

const PEER = 100001;
const SHARED_ALBUM = 901;
const UNSHARED_ALBUM = 900;
const LOCKED_ALBUM = 902;

const albums = demoMyAlbums().albums;
const onClose = vi.fn<() => void>();
let selections: TabSelection[];
let answerShares: () => void;

function tile(albumId: number): HTMLButtonElement {
	const index = albums.findIndex((album) => album.albumId === albumId);
	const tiles = document.querySelectorAll<HTMLButtonElement>(
		'[data-slot="album-tile"]',
	);
	const found = tiles[index];
	if (found === undefined) throw new Error(`no tile for album ${albumId}`);
	return found;
}

function isBadgedShared(albumId: number): boolean {
	return (
		tile(albumId).querySelector('[data-slot="album-shared-badge"]') !== null
	);
}

const armed = () => selections.at(-1);

async function mount() {
	const rendered = render(ComposerAlbumsTab, {
		props: {
			onClose,
			onSelectionChange: (selection: TabSelection) => {
				selections.push(selection);
			},
		},
	});
	await tick();
	await tick();
	return rendered.component;
}

async function settle() {
	answerShares();
	await tick();
	await tick();
}

beforeEach(() => {
	albumShares.clear();
	selections = [];
	onClose.mockReset();
	toastError.mockReset();
	preferences.preferencesSnapshot.mockReturnValue({
		albumShareExpiration: "INDEFINITE",
	});
	preferences.setPreferences.mockReset().mockResolvedValue(undefined);
	for (const mock of Object.values(api)) mock.mockReset();
	api.getMyAlbums.mockResolvedValue({ albums });
	api.shareAlbum.mockResolvedValue(undefined);
	api.unshareAlbum.mockResolvedValue(undefined);
	const answers: (() => void)[] = [];
	answerShares = () => answers.forEach((answer) => answer());
	api.getAlbumShares.mockImplementation(
		(albumId: number) =>
			new Promise<{ profileIds: number[] }>((resolve) => {
				answers.push(() =>
					resolve({
						profileIds: albumId === SHARED_ALBUM ? [PEER] : [],
					}),
				);
			}),
	);
	vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

describe("composer albums tab", () => {
	it("keeps tiles shut until their share status is known", async () => {
		await mount();
		expect(tile(UNSHARED_ALBUM).disabled).toBe(true);
		expect(tile(SHARED_ALBUM).disabled).toBe(true);

		tile(UNSHARED_ALBUM).click();
		await tick();
		expect(armed()).toBeUndefined();

		await settle();
		expect(tile(UNSHARED_ALBUM).disabled).toBe(false);
		expect(tile(SHARED_ALBUM).disabled).toBe(false);
		expect(tile(LOCKED_ALBUM).disabled).toBe(true);
		expect(isBadgedShared(SHARED_ALBUM)).toBe(true);
		expect(isBadgedShared(UNSHARED_ALBUM)).toBe(false);
	});

	it("picking a shared album arms Unshare and dims the unshared ones", async () => {
		await mount();
		await settle();

		tile(SHARED_ALBUM).click();
		await tick();

		expect(armed()).toEqual({ count: 1, label: "Unshare" });
		expect(tile(UNSHARED_ALBUM).disabled).toBe(true);
		expect(tile(UNSHARED_ALBUM).className).toContain("opacity-50");
	});

	it("picking an unshared album arms Share and dims the shared ones", async () => {
		await mount();
		await settle();

		tile(UNSHARED_ALBUM).click();
		await tick();
		expect(armed()).toEqual({ count: 1, label: "Share" });
		expect(tile(SHARED_ALBUM).disabled).toBe(true);
		expect(tile(SHARED_ALBUM).className).toContain("opacity-50");

		tile(UNSHARED_ALBUM).click();
		await tick();
		expect(armed()).toEqual({ count: 0, label: "Share" });
		expect(tile(SHARED_ALBUM).disabled).toBe(false);
	});

	it("locks every tile while an unshare is in flight and keeps the drawer open", async () => {
		let finish!: () => void;
		api.unshareAlbum.mockReturnValue(
			new Promise<void>((resolve) => {
				finish = resolve;
			}),
		);
		const component = await mount();
		await settle();

		tile(SHARED_ALBUM).click();
		await tick();
		component.submitSelection();
		await tick();

		expect(api.unshareAlbum).toHaveBeenCalledWith({
			albumId: SHARED_ALBUM,
			profileIds: [PEER],
		});
		expect(api.shareAlbum).not.toHaveBeenCalled();
		expect(onClose).not.toHaveBeenCalled();
		expect(armed()).toEqual({ count: 0, label: "Share" });
		for (const albumId of [UNSHARED_ALBUM, SHARED_ALBUM, LOCKED_ALBUM]) {
			expect(tile(albumId).disabled).toBe(true);
			expect(tile(albumId).className).toContain("opacity-50");
		}

		finish();
		await tick();
		await tick();
		expect(tile(UNSHARED_ALBUM).disabled).toBe(false);
		expect(tile(SHARED_ALBUM).disabled).toBe(false);
		expect(tile(UNSHARED_ALBUM).className).not.toContain("opacity-50");
		expect(isBadgedShared(SHARED_ALBUM)).toBe(false);
	});

	it("submits a share selection to the share endpoint", async () => {
		const component = await mount();
		await settle();

		tile(UNSHARED_ALBUM).click();
		await tick();
		component.submitSelection();

		expect(api.shareAlbum).toHaveBeenCalledWith({
			albumId: UNSHARED_ALBUM,
			profileIds: [PEER],
			expirationType: "INDEFINITE",
		});
		expect(api.unshareAlbum).not.toHaveBeenCalled();
	});

	it.each<AlbumExpirationType>([
		"INDEFINITE",
		"ONCE",
		"TEN_MINUTES",
		"ONE_HOUR",
		"ONE_DAY",
	])(
		"shares with %s and remembers it for the next share",
		async (expirationType) => {
			const component = await mount();
			await settle();
			const select = document.querySelector("select")!;
			expect(select.value).toBe("INDEFINITE");
			expect(select.options).toHaveLength(5);
			await fireEvent.change(select, {
				target: { value: expirationType },
			});
			expect(preferences.setPreferences).toHaveBeenCalledWith({
				albumShareExpiration: expirationType,
			});
			tile(UNSHARED_ALBUM).click();
			await tick();
			component.submitSelection();
			expect(api.shareAlbum).toHaveBeenCalledWith({
				albumId: UNSHARED_ALBUM,
				profileIds: [PEER],
				expirationType,
			});

			cleanup();
			preferences.preferencesSnapshot.mockReturnValue({
				albumShareExpiration: expirationType,
			});
			await mount();
			expect(document.querySelector("select")?.value).toBe(
				expirationType,
			);
		},
	);

	it("disables expiration when unsharing without changing the saved choice", async () => {
		preferences.preferencesSnapshot.mockReturnValue({
			albumShareExpiration: "ONE_DAY",
		});
		await mount();
		await settle();
		tile(SHARED_ALBUM).click();
		await tick();
		const select = document.querySelector("select")!;
		expect(select.disabled).toBe(true);
		expect(select.value).toBe("ONE_DAY");
		expect(preferences.setPreferences).not.toHaveBeenCalled();
	});

	it("still uses the selected expiry if saving the preference fails", async () => {
		preferences.setPreferences.mockRejectedValue(new Error("disk full"));
		const component = await mount();
		await settle();
		await fireEvent.change(document.querySelector("select")!, {
			target: { value: "TEN_MINUTES" },
		});
		expect(toastError).toHaveBeenCalledWith(
			"Couldn't save album expiration preference",
		);
		tile(UNSHARED_ALBUM).click();
		await tick();
		component.submitSelection();
		expect(api.shareAlbum).toHaveBeenCalledWith({
			albumId: UNSHARED_ALBUM,
			profileIds: [PEER],
			expirationType: "TEN_MINUTES",
		});
	});

	it("rolls back the badge, the lock and the selection when an unshare fails", async () => {
		api.unshareAlbum.mockRejectedValue(new Error("403"));
		const component = await mount();
		await settle();

		tile(SHARED_ALBUM).click();
		await tick();
		component.submitSelection();
		await tick();
		await tick();

		expect(isBadgedShared(SHARED_ALBUM)).toBe(true);
		expect(toastError).toHaveBeenCalledWith("Couldn't unshare album");
		expect(tile(SHARED_ALBUM).disabled).toBe(false);
		expect(tile(SHARED_ALBUM).getAttribute("aria-pressed")).toBe("true");
		expect(armed()).toEqual({ count: 1, label: "Unshare" });
	});
});
