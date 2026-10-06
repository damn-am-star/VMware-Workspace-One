import z from "zod";

import type { SavedPhrase } from "$lib/api/messaging/phrases";

const phrases: SavedPhrase[] = [
	{ id: "demo-phrase-1", text: "Hey! How’s your day going?", type: "user" },
	{
		id: "demo-phrase-2",
		text: "Want to grab a coffee sometime?",
		type: "user",
	},
	{
		id: "demo-phrase-3",
		text: "I’ll be there in a few minutes.",
		type: "user",
	},
];

export function demoSavedPhrases() {
	return { phrases: phrases.map((phrase) => ({ ...phrase })) };
}

export function demoCreateSavedPhrase(body: unknown) {
	const { text } = z.object({ text: z.string() }).parse(body);
	const phrase = { id: crypto.randomUUID(), text, type: "user" };
	phrases.push(phrase);
	return { phrase: { ...phrase } };
}

export function demoDeleteSavedPhrase(id: string) {
	const index = phrases.findIndex((phrase) => phrase.id === id);
	if (index !== -1) phrases.splice(index, 1);
}
