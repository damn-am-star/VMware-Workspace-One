import { describe, expect, it } from "vitest";
import z from "zod";

import { savedPhraseSchema } from "$lib/api/messaging/phrases";
import { demoRoute } from "$lib/demo";

function listPhrases() {
	return z
		.object({ phrases: z.array(savedPhraseSchema) })
		.parse(
			demoRoute({
				path: "/v1/chat/phrases",
				method: "GET",
				body: undefined,
			}).body,
		).phrases;
}

describe("demo saved phrases", () => {
	it("provides sample phrases and persists creation and deletion across reads", () => {
		const before = listPhrases();
		expect(before.length).toBeGreaterThan(0);
		const text = "A new phrase\nwith a second line.";
		const created = demoRoute({
			path: "/v1/chat/phrases",
			method: "POST",
			body: { text },
		});
		expect(created.status).toBe(200);
		const { phrase } = z
			.object({ phrase: savedPhraseSchema })
			.parse(created.body);
		expect(phrase.text).toBe(text);
		expect(listPhrases()).toEqual([...before, phrase]);
		const removed = demoRoute({
			path: `/v3/me/prefs/phrases/${phrase.id}`,
			method: "DELETE",
			body: undefined,
		});
		expect(removed.status).toBe(200);
		expect(listPhrases()).toEqual(before);
	});

	it("rejects creation without the documented text field", () => {
		const before = listPhrases();
		expect(() =>
			demoRoute({
				path: "/v1/chat/phrases",
				method: "POST",
				body: { phrase: "Hello" },
			}),
		).toThrow();
		expect(listPhrases()).toEqual(before);
	});

	it("returns copies so callers cannot modify the demo's stored phrases", () => {
		const [phrase] = listPhrases();
		if (!phrase) throw new Error("no demo phrase");
		const before = phrase.text;
		phrase.text = "Changed only in this response";
		expect(listPhrases().find((item) => item.id === phrase.id)?.text).toBe(
			before,
		);
	});
});
