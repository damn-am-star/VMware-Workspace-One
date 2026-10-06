// @vitest-environment jsdom

import { decode } from "@msgpack/msgpack";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { api, write, showErrorToast } = vi.hoisted(() => ({
	api: {
		getSavedPhrases: vi.fn(),
		createSavedPhrase: vi.fn(),
		deleteSavedPhrase: vi.fn(),
	},
	write: vi.fn(),
	showErrorToast: vi.fn(),
}));

vi.mock("$lib/api/messaging/phrases", () => api);
vi.mock("$lib/api/error-toast", () => ({ showErrorToast }));
vi.mock("$lib/app-data", () => ({
	existsAppDataFile: () => Promise.resolve(false),
	readAppDataFile: vi.fn(),
	removeAppDataFile: vi.fn(),
	writeAppDataFileAtomic: write,
}));

import { clearAccountCaches } from "$lib/api/account-caches";
import { setPreferences } from "$lib/app-data/preferences.svelte";
import SavedPhrasesPage from "./+page.svelte";

const PHRASES = [
	{ id: "first", text: "Hey!", type: "custom" },
	{ id: "second", text: "Want coffee?", type: "custom" },
	{ id: "third", text: "See you soon.", type: "custom" },
];

function openPage() {
	return render(SavedPhrasesPage, {
		props: { data: { ourProfileId: 1 }, params: {} },
	});
}

function rows() {
	return screen.getAllByRole("listitem");
}

function row(index: number) {
	const item = rows()[index];
	if (!item) throw new Error(`Missing phrase at index ${index}`);
	return within(item);
}

function texts() {
	return rows().map((row) => row.querySelector("p")?.textContent);
}

async function opened() {
	openPage();
	await screen.findByRole("list", { name: "Saved phrases" });
}

describe("saved phrases settings", () => {
	beforeEach(async () => {
		api.getSavedPhrases.mockReset().mockResolvedValue({ phrases: PHRASES });
		api.createSavedPhrase.mockReset();
		api.deleteSavedPhrase.mockReset().mockResolvedValue(undefined);
		write.mockReset().mockResolvedValue(undefined);
		showErrorToast.mockReset();
		await setPreferences({ savedPhraseOrder: [] });
		write.mockClear();
	});

	afterEach(() => {
		cleanup();
		clearAccountCaches();
	});

	it("rejects blank input and adds trimmed multiline text", async () => {
		await opened();
		const input = screen.getByRole<HTMLTextAreaElement>("textbox", {
			name: "New phrase",
		});
		const add = screen.getByRole<HTMLButtonElement>("button", {
			name: "Add phrase",
		});
		await fireEvent.input(input, { target: { value: "  \n  " } });
		expect(add.disabled).toBe(true);
		const form = input.form;
		if (!form) throw new Error("Missing phrase form");
		await fireEvent.submit(form);
		expect(api.createSavedPhrase).not.toHaveBeenCalled();

		api.createSavedPhrase.mockResolvedValueOnce({
			phrase: { id: "new", text: "Hello\nthere", type: "custom" },
		});
		await fireEvent.input(input, { target: { value: "  Hello\nthere  " } });
		await fireEvent.click(add);
		await vi.waitFor(() => expect(rows()).toHaveLength(4));
		expect(api.createSavedPhrase).toHaveBeenCalledWith({
			text: "Hello\nthere",
		});
		expect(input.value).toBe("");
		expect(texts()).toEqual([
			...PHRASES.map(({ text }) => text),
			"Hello\nthere",
		]);
	});

	it("keeps the input and list when adding fails", async () => {
		await opened();
		const error = new Error("offline");
		api.createSavedPhrase.mockRejectedValueOnce(error);
		const input = screen.getByRole<HTMLTextAreaElement>("textbox", {
			name: "New phrase",
		});
		await fireEvent.input(input, { target: { value: "  keep this  " } });
		await fireEvent.click(
			screen.getByRole("button", { name: "Add phrase" }),
		);
		await vi.waitFor(() =>
			expect(showErrorToast).toHaveBeenCalledWith({
				label: "Failed to update saved phrases",
				error,
			}),
		);
		expect(input.value).toBe("  keep this  ");
		expect(texts()).toEqual(PHRASES.map(({ text }) => text));
	});

	it("keeps a phrase when deleting fails and removes it after retry succeeds", async () => {
		await opened();
		api.deleteSavedPhrase.mockRejectedValueOnce(new Error("offline"));
		await fireEvent.click(row(1).getByRole("button", { name: "Delete" }));
		await vi.waitFor(() => expect(showErrorToast).toHaveBeenCalledOnce());
		expect(texts()).toEqual(PHRASES.map(({ text }) => text));

		await fireEvent.click(row(1).getByRole("button", { name: "Delete" }));
		await vi.waitFor(() =>
			expect(texts()).toEqual(["Hey!", "See you soon."]),
		);
		expect(api.deleteSavedPhrase).toHaveBeenCalledWith({ id: "second" });
	});

	it("keeps shared state reactive after reopening settings", async () => {
		const { unmount } = openPage();
		await screen.findByRole("list", { name: "Saved phrases" });
		unmount();
		await opened();
		await fireEvent.click(row(1).getByRole("button", { name: "Delete" }));
		await vi.waitFor(() =>
			expect(texts()).toEqual(["Hey!", "See you soon."]),
		);
	});

	it("keeps the order on disk failure and commits a retried move", async () => {
		await opened();
		expect(
			row(0).getByRole<HTMLButtonElement>("button", { name: "Move up" })
				.disabled,
		).toBe(true);
		expect(
			row(2).getByRole<HTMLButtonElement>("button", { name: "Move down" })
				.disabled,
		).toBe(true);
		write.mockRejectedValueOnce(new Error("disk full"));
		await fireEvent.click(row(1).getByRole("button", { name: "Move up" }));
		await vi.waitFor(() => expect(showErrorToast).toHaveBeenCalledOnce());
		expect(texts()).toEqual(PHRASES.map(({ text }) => text));

		await fireEvent.click(row(1).getByRole("button", { name: "Move up" }));
		await vi.waitFor(() =>
			expect(texts()).toEqual(["Want coffee?", "Hey!", "See you soon."]),
		);
		const { content } = write.mock.lastCall![0] as { content: Uint8Array };
		expect(decode(content)).toMatchObject({
			savedPhraseOrder: ["second", "first", "third"],
		});
	});

	it("disables mutations while an add is pending and retains the old list", async () => {
		await opened();
		let resolve!: (value: { phrase: (typeof PHRASES)[number] }) => void;
		api.createSavedPhrase.mockReturnValueOnce(
			new Promise((settle) => {
				resolve = settle;
			}),
		);
		await fireEvent.input(
			screen.getByRole<HTMLTextAreaElement>("textbox", {
				name: "New phrase",
			}),
			{ target: { value: "New" } },
		);
		await fireEvent.click(
			screen.getByRole("button", { name: "Add phrase" }),
		);
		expect(texts()).toEqual(PHRASES.map(({ text }) => text));
		for (const button of screen.getAllByRole<HTMLButtonElement>("button")) {
			expect(button.disabled).toBe(true);
		}
		resolve({ phrase: { id: "new", text: "New", type: "custom" } });
		await vi.waitFor(() => expect(rows()).toHaveLength(4));
	});

	it("shows loading, load failure and retry, then an empty list", async () => {
		let reject!: (error: Error) => void;
		api.getSavedPhrases.mockReturnValueOnce(
			new Promise((_, fail) => {
				reject = fail;
			}),
		);
		openPage();
		expect(screen.getByRole("status").textContent).toContain(
			"Loading saved phrases",
		);
		reject(new Error("offline"));
		await screen.findByRole("alert");
		api.getSavedPhrases.mockResolvedValueOnce({ phrases: [] });
		await fireEvent.click(screen.getByRole("button", { name: "Retry" }));
		await screen.findByText("No saved phrases yet.");
		expect(screen.queryByRole("alert")).toBeNull();
		expect(
			screen.getByRole<HTMLTextAreaElement>("textbox", {
				name: "New phrase",
			}).disabled,
		).toBe(false);
	});
});
