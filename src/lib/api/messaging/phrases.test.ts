import { beforeEach, describe, expect, it, vi } from "vitest";
import type z from "zod";

const { fetchRestMock } = vi.hoisted(() => ({ fetchRestMock: vi.fn() }));

vi.mock("$lib/api/transport", () => ({ fetchRest: fetchRestMock }));

import {
	createSavedPhrase,
	deleteSavedPhrase,
	getSavedPhrases,
} from "$lib/api/messaging/phrases";

const phrase = { id: "phrase-1", text: "Hello\nthere!", type: "user" };
const assertOk = vi.fn();
const jsonParsed = vi.fn();

function response(body: unknown) {
	jsonParsed.mockImplementation((schema: z.ZodType) => schema.parse(body));
}

beforeEach(() => {
	vi.resetAllMocks();
	fetchRestMock.mockResolvedValue({ assertOk, jsonParsed });
});

describe("saved phrases API", () => {
	it("lists phrases with string IDs and exact text", async () => {
		response({ phrases: [phrase] });

		await expect(getSavedPhrases()).resolves.toEqual({ phrases: [phrase] });
		expect(fetchRestMock).toHaveBeenCalledWith("/v1/chat/phrases");
	});

	it.each([
		{},
		{ phrases: null },
		{ phrases: [{ ...phrase, id: 1 }] },
		{ phrases: [{ ...phrase, text: null }] },
		{ phrases: [{ id: phrase.id, text: phrase.text }] },
	])("rejects a malformed list response: %j", async (body) => {
		response(body);
		await expect(getSavedPhrases()).rejects.toThrow();
	});

	it("creates a phrase through the current endpoint and validates its envelope", async () => {
		response({ phrase });

		await expect(createSavedPhrase({ text: phrase.text })).resolves.toEqual(
			{ phrase },
		);
		expect(fetchRestMock).toHaveBeenCalledWith("/v1/chat/phrases", {
			method: "POST",
			body: { text: phrase.text },
		});
	});

	it.each([{}, phrase, { phrase: { ...phrase, type: 1 } }])(
		"rejects a malformed creation response: %j",
		async (body) => {
			response(body);
			await expect(
				createSavedPhrase({ text: "Hello" }),
			).rejects.toThrow();
		},
	);

	it("deletes a phrase with an encoded ID and checks the status", async () => {
		await deleteSavedPhrase({ id: "phrase/1" });

		expect(fetchRestMock).toHaveBeenCalledWith(
			"/v3/me/prefs/phrases/phrase%2F1",
			{ method: "DELETE" },
		);
		expect(assertOk).toHaveBeenCalledOnce();
	});

	it("propagates a failed deletion", async () => {
		assertOk.mockImplementation(() => {
			throw new Error("403");
		});

		await expect(deleteSavedPhrase({ id: phrase.id })).rejects.toThrow(
			"403",
		);
	});
});
