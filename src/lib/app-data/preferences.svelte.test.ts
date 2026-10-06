import { decode, encode } from "@msgpack/msgpack";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { files } = vi.hoisted(() => ({
	files: {
		existsAppDataFile: vi.fn(),
		readAppDataFile: vi.fn(),
		writeAppDataFileAtomic: vi.fn(),
		removeAppDataFile: vi.fn(),
	},
}));

vi.mock("$lib/app-data", () => files);

beforeEach(() => {
	vi.resetModules();
	vi.resetAllMocks();
	files.existsAppDataFile.mockResolvedValue(true);
	files.readAppDataFile.mockResolvedValue(encode({}));
	files.writeAppDataFileAtomic.mockResolvedValue(undefined);
	files.removeAppDataFile.mockResolvedValue(undefined);
});

describe("saved phrase preferences", () => {
	it("defaults to an empty order when older preferences omit the field", async () => {
		files.readAppDataFile.mockResolvedValueOnce(
			encode({ units: "imperial" }),
		);
		const preferences = await import("./preferences.svelte");
		await preferences.hydratePreferences();
		expect(preferences.preferencesSnapshot().savedPhraseOrder).toEqual([]);
		expect(preferences.preferencesSnapshot().units).toBe("imperial");
	});

	it("stores an order and restores it after app restart", async () => {
		const preferences = await import("./preferences.svelte");
		await preferences.setPreferences({ savedPhraseOrder: ["c", "a", "b"] });
		const write = files.writeAppDataFileAtomic.mock.calls[0]?.[0] as {
			path: string;
			content: Uint8Array;
		};
		expect(write.path).toBe("preferences.data");
		expect(decode(write.content)).toMatchObject({
			savedPhraseOrder: ["c", "a", "b"],
		});
		vi.resetModules();
		files.readAppDataFile.mockResolvedValueOnce(write.content);
		const restarted = await import("./preferences.svelte");
		await restarted.hydratePreferences();
		expect(restarted.preferencesSnapshot().savedPhraseOrder).toEqual([
			"c",
			"a",
			"b",
		]);
	});

	it("retains the previous order when persistence fails and allows a later write", async () => {
		files.readAppDataFile.mockResolvedValueOnce(
			encode({ savedPhraseOrder: ["a", "b"] }),
		);
		const preferences = await import("./preferences.svelte");
		await preferences.hydratePreferences();
		files.writeAppDataFileAtomic.mockRejectedValueOnce(
			new Error("disk full"),
		);
		await expect(
			preferences.setPreferences({ savedPhraseOrder: ["b", "a"] }),
		).rejects.toThrow("disk full");
		expect(preferences.preferencesSnapshot().savedPhraseOrder).toEqual([
			"a",
			"b",
		]);
		expect((await preferences.getPreferences()).savedPhraseOrder).toEqual([
			"a",
			"b",
		]);
		await preferences.setPreferences({ savedPhraseOrder: ["b", "a"] });
		expect(preferences.preferencesSnapshot().savedPhraseOrder).toEqual([
			"b",
			"a",
		]);
	});

	it("resets account order on sign-out while retaining device preferences", async () => {
		files.readAppDataFile.mockResolvedValueOnce(
			encode({
				savedPhraseOrder: ["c", "a"],
				autoUpdateLocation: true,
				notificationsEnabled: true,
				hapticFeedback: false,
				units: "imperial",
				onboardingComplete: true,
			}),
		);
		const preferences = await import("./preferences.svelte");
		await preferences.clearAccountPreferences();
		expect(preferences.preferencesSnapshot()).toMatchObject({
			savedPhraseOrder: [],
			autoUpdateLocation: false,
			notificationsEnabled: false,
			hapticFeedback: false,
			units: "imperial",
			onboardingComplete: true,
		});
		const write = files.writeAppDataFileAtomic.mock.calls[0]?.[0] as {
			content: Uint8Array;
		};
		expect(decode(write.content)).toMatchObject({
			savedPhraseOrder: [],
			units: "imperial",
		});
		expect(files.removeAppDataFile).not.toHaveBeenCalled();
	});

	it("removes the preference file when sign-out leaves only defaults", async () => {
		files.readAppDataFile.mockResolvedValueOnce(
			encode({ savedPhraseOrder: ["a"] }),
		);
		const preferences = await import("./preferences.svelte");
		await preferences.clearAccountPreferences();
		expect(preferences.preferencesSnapshot().savedPhraseOrder).toEqual([]);
		expect(files.removeAppDataFile).toHaveBeenCalledWith(
			"preferences.data",
		);
		expect(files.writeAppDataFileAtomic).not.toHaveBeenCalled();
	});

	it("clears account order after an in-flight reorder write completes", async () => {
		files.readAppDataFile.mockResolvedValueOnce(
			encode({ savedPhraseOrder: ["a", "b"], units: "imperial" }),
		);
		const preferences = await import("./preferences.svelte");
		await preferences.hydratePreferences();
		let finishWrite!: () => void;
		let notifyStarted!: () => void;
		const started = new Promise<void>((resolve) => {
			notifyStarted = resolve;
		});
		const writing = new Promise<void>((resolve) => {
			finishWrite = resolve;
		});
		files.writeAppDataFileAtomic.mockImplementationOnce(() => {
			notifyStarted();
			return writing;
		});
		const reorder = preferences.setPreferences({
			savedPhraseOrder: ["b", "a"],
		});
		await started;
		const signOut = preferences.clearAccountPreferences();
		expect(preferences.preferencesSnapshot().savedPhraseOrder).toEqual([
			"a",
			"b",
		]);
		expect(files.writeAppDataFileAtomic).toHaveBeenCalledOnce();
		finishWrite();
		await Promise.all([reorder, signOut]);
		expect(preferences.preferencesSnapshot().savedPhraseOrder).toEqual([]);
		expect(files.writeAppDataFileAtomic).toHaveBeenCalledTimes(2);
		const finalWrite = files.writeAppDataFileAtomic.mock.calls[1]?.[0] as {
			content: Uint8Array;
		};
		expect(decode(finalWrite.content)).toMatchObject({
			savedPhraseOrder: [],
			units: "imperial",
		});
	});
});
