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

describe("album share expiration preferences", () => {
	it.each([undefined, "UNKNOWN", null])(
		"defaults legacy or invalid expiration %s to unlimited",
		async (albumShareExpiration) => {
			files.readAppDataFile.mockResolvedValueOnce(
				encode({
					...(albumShareExpiration === undefined
						? {}
						: { albumShareExpiration }),
					units: "imperial",
				}),
			);
			const preferences = await import("./preferences.svelte");
			await preferences.hydratePreferences();
			expect(preferences.preferencesSnapshot()).toMatchObject({
				albumShareExpiration: "INDEFINITE",
				units: "imperial",
			});
		},
	);

	it("restores the selected expiration after app restart", async () => {
		const preferences = await import("./preferences.svelte");
		await preferences.setPreferences({ albumShareExpiration: "ONE_HOUR" });
		const write = files.writeAppDataFileAtomic.mock.calls[0]?.[0] as {
			content: Uint8Array;
		};
		expect(decode(write.content)).toMatchObject({
			albumShareExpiration: "ONE_HOUR",
		});
		vi.resetModules();
		files.readAppDataFile.mockResolvedValueOnce(write.content);
		const restarted = await import("./preferences.svelte");
		await restarted.hydratePreferences();
		expect(restarted.preferencesSnapshot().albumShareExpiration).toBe(
			"ONE_HOUR",
		);
	});

	it("retains the selected expiration on sign-out", async () => {
		files.readAppDataFile.mockResolvedValueOnce(
			encode({ albumShareExpiration: "ONCE", autoUpdateLocation: true }),
		);
		const preferences = await import("./preferences.svelte");
		await preferences.clearAccountPreferences();
		expect(preferences.preferencesSnapshot()).toMatchObject({
			albumShareExpiration: "ONCE",
			autoUpdateLocation: false,
		});
		const write = files.writeAppDataFileAtomic.mock.calls[0]?.[0] as {
			content: Uint8Array;
		};
		expect(decode(write.content)).toMatchObject({
			albumShareExpiration: "ONCE",
		});
		expect(files.removeAppDataFile).not.toHaveBeenCalled();
	});
});
