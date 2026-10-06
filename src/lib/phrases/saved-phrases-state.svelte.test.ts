import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { api, persist, hydrate } = vi.hoisted(() => ({
	api: {
		getSavedPhrases: vi.fn(),
		createSavedPhrase: vi.fn(),
		deleteSavedPhrase: vi.fn(),
	},
	persist: vi.fn(),
	hydrate: vi.fn(),
}));

let preferences = $state({ savedPhraseOrder: [] as string[] });

vi.mock("$lib/api/messaging/phrases", () => api);
vi.mock("$lib/app-data/preferences.svelte", () => ({
	hydratePreferences: hydrate,
	preferencesSnapshot: () => preferences,
	setPreferences: async (values: { savedPhraseOrder: string[] }) => {
		await persist(values);
		preferences = values;
	},
}));

import { clearAccountCaches } from "$lib/api/account-caches";
import type { SavedPhrase } from "$lib/api/messaging/phrases";
import {
	getSavedPhrasesState,
	orderPhrases,
} from "./saved-phrases-state.svelte";

const phrases: SavedPhrase[] = [
	{ id: "a", text: "Hello", type: "user" },
	{ id: "b", text: "How are you?", type: "user" },
	{ id: "c", text: "See you soon", type: "user" },
];
const added: SavedPhrase = { id: "d", text: "Good evening", type: "user" };

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason: unknown) => void;
	const promise = new Promise<T>((settle, fail) => {
		resolve = settle;
		reject = fail;
	});
	return { promise, resolve, reject };
}

async function loadedState() {
	const state = getSavedPhrasesState(1);
	await state.refresh();
	return state;
}

beforeEach(() => {
	vi.resetAllMocks();
	preferences = { savedPhraseOrder: [] };
	hydrate.mockResolvedValue(undefined);
	persist.mockResolvedValue(undefined);
	api.getSavedPhrases.mockResolvedValue({ phrases });
	api.createSavedPhrase.mockResolvedValue({ phrase: added });
	api.deleteSavedPhrase.mockResolvedValue(undefined);
});

afterEach(() => {
	clearAccountCaches();
});

describe("saved phrase order", () => {
	it("ignores missing and duplicate saved IDs and appends unlisted phrases in API order", () => {
		expect(orderPhrases(phrases, ["c", "missing", "c", "a"])).toEqual([
			phrases[2],
			phrases[0],
			phrases[1],
		]);
		expect(orderPhrases(phrases, [])).toEqual(phrases);
	});

	it("publishes a move only after preference persistence succeeds", async () => {
		const state = await loadedState();
		const write = deferred<void>();
		persist.mockReturnValueOnce(write.promise);
		const moving = state.move(0, 2);

		expect(state.pending).toBe(true);
		expect(state.ordered).toEqual(phrases);
		expect(persist).toHaveBeenCalledWith({
			savedPhraseOrder: ["b", "c", "a"],
		});
		write.resolve();
		await expect(moving).resolves.toBe(true);
		expect(state.ordered).toEqual([phrases[1], phrases[2], phrases[0]]);
		expect(state.pending).toBe(false);
	});

	it("retains the order when persistence fails and permits retry", async () => {
		preferences.savedPhraseOrder = ["c", "a", "b"];
		const state = await loadedState();
		persist.mockRejectedValueOnce(new Error("disk full"));

		await expect(state.move(0, 1)).rejects.toThrow("disk full");
		expect(state.ordered).toEqual([phrases[2], phrases[0], phrases[1]]);
		expect(preferences.savedPhraseOrder).toEqual(["c", "a", "b"]);
		expect(state.pending).toBe(false);
		await expect(state.move(0, 1)).resolves.toBe(true);
	});
});

describe("saved phrase refresh", () => {
	it("shares overlapping requests and leaves the list empty until they complete", async () => {
		const state = getSavedPhrasesState(1);
		const load = deferred<{ phrases: SavedPhrase[] }>();
		api.getSavedPhrases.mockReturnValueOnce(load.promise);
		const first = state.refresh();
		const second = state.refresh();

		expect(first).toBe(second);
		expect(state.phrases).toBeNull();
		expect(api.getSavedPhrases).toHaveBeenCalledOnce();
		load.resolve({ phrases });
		await first;
		expect(state.phrases).toEqual(phrases);
	});

	it("reports a failed load and clears the error on retry", async () => {
		const state = getSavedPhrasesState(1);
		const failure = new Error("offline");
		api.getSavedPhrases.mockRejectedValueOnce(failure);
		await state.refresh();
		expect(state.phrases).toBeNull();
		expect(state.error).toBe(failure);
		const retry = state.refresh();
		expect(state.error).toBeNull();
		await retry;
		expect(state.phrases).toEqual(phrases);
	});

	it("preserves an existing list during refresh and after a load failure", async () => {
		const state = await loadedState();
		api.getSavedPhrases.mockRejectedValueOnce(new Error("offline"));
		const refresh = state.refresh();
		expect(state.phrases).toEqual(phrases);
		await refresh;
		expect(state.phrases).toEqual(phrases);
		expect(state.error).toBeInstanceOf(Error);
	});

	it("ignores a response from before a successful deletion", async () => {
		const state = await loadedState();
		const stale = deferred<{ phrases: SavedPhrase[] }>();
		api.getSavedPhrases.mockReturnValueOnce(stale.promise);
		const refreshing = state.refresh();
		await state.remove("a");
		stale.resolve({ phrases });
		await refreshing;
		expect(state.phrases).toEqual(phrases.slice(1));
	});

	it("ignores a stale failed load after an addition", async () => {
		const state = await loadedState();
		let reject!: (reason: unknown) => void;
		api.getSavedPhrases.mockReturnValueOnce(
			new Promise((_, fail) => {
				reject = fail;
			}),
		);
		const refreshing = state.refresh();
		await state.add(added.text);
		reject(new Error("stale error"));
		await refreshing;
		expect(state.phrases).toEqual([...phrases, added]);
		expect(state.error).toBeNull();
	});

	it("cannot publish a late load after sign-out and creates fresh state", async () => {
		const state = getSavedPhrasesState(1);
		const load = deferred<{ phrases: SavedPhrase[] }>();
		api.getSavedPhrases.mockReturnValueOnce(load.promise);
		const refreshing = state.refresh();
		clearAccountCaches();
		load.resolve({ phrases });
		await refreshing;
		expect(state.phrases).toBeNull();
		expect(getSavedPhrasesState(1)).not.toBe(state);
		expect(getSavedPhrasesState(1).phrases).toBeNull();
	});

	it("shares state only within the same account", async () => {
		const first = await loadedState();
		expect(getSavedPhrasesState(1)).toBe(first);
		expect(getSavedPhrasesState(2).phrases).toBeNull();
		expect(first.phrases).toBeNull();
	});
});

describe("saved phrase mutations", () => {
	it("trims additions, rejects blank text, and commits only after API success", async () => {
		const state = await loadedState();
		await expect(state.add(" \n\t ")).resolves.toBe(false);
		expect(api.createSavedPhrase).not.toHaveBeenCalled();
		const create = deferred<{ phrase: SavedPhrase }>();
		api.createSavedPhrase.mockReturnValueOnce(create.promise);
		const adding = state.add("  Good evening\n");
		expect(api.createSavedPhrase).toHaveBeenCalledWith({
			text: added.text,
		});
		expect(state.phrases).toEqual(phrases);
		await expect(state.remove("a")).resolves.toBe(false);
		expect(api.deleteSavedPhrase).not.toHaveBeenCalled();
		create.resolve({ phrase: added });
		await expect(adding).resolves.toBe(true);
		expect(state.phrases).toEqual([...phrases, added]);
	});

	it.each(["add", "remove"] as const)(
		"preserves data and releases pending state after %s fails",
		async (operation) => {
			const state = await loadedState();
			const failure = new Error("offline");
			api.createSavedPhrase.mockRejectedValueOnce(failure);
			api.deleteSavedPhrase.mockRejectedValueOnce(failure);
			await expect(
				state[operation](operation === "add" ? added.text : "a"),
			).rejects.toBe(failure);
			expect(state.phrases).toEqual(phrases);
			expect(state.pending).toBe(false);
		},
	);

	it.each(["add", "remove"] as const)(
		"cannot publish a late %s after sign-out",
		async (operation) => {
			const state = await loadedState();
			const mutation = deferred<{ phrase: SavedPhrase }>();
			api.createSavedPhrase.mockReturnValueOnce(mutation.promise);
			api.deleteSavedPhrase.mockReturnValueOnce(mutation.promise);
			const changing = state[operation](
				operation === "add" ? added.text : "a",
			);
			clearAccountCaches();
			mutation.resolve({ phrase: added });
			await expect(changing).resolves.toBe(false);
			expect(state.phrases).toBeNull();
			expect(getSavedPhrasesState(2).phrases).toBeNull();
		},
	);

	it.each(["add", "remove"] as const)(
		"ignores a late %s failure after sign-out",
		async (operation) => {
			const state = await loadedState();
			const mutation = deferred<{ phrase: SavedPhrase }>();
			api.createSavedPhrase.mockReturnValueOnce(mutation.promise);
			api.deleteSavedPhrase.mockReturnValueOnce(mutation.promise);
			const changing = state[operation](
				operation === "add" ? added.text : "a",
			);
			clearAccountCaches();
			mutation.reject(new Error("old account request failed"));
			await expect(changing).resolves.toBe(false);
			expect(state.phrases).toBeNull();
			expect(state.error).toBeNull();
			expect(state.pending).toBe(false);
			expect(getSavedPhrasesState(2).error).toBeNull();
		},
	);
});
