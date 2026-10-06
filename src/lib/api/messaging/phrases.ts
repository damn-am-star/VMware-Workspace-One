import z from "zod";

import { fetchRest } from "$lib/api/transport";

export const savedPhraseSchema = z.object({
	id: z.string(),
	text: z.string(),
	type: z.string(),
});

export type SavedPhrase = z.infer<typeof savedPhraseSchema>;

export async function getSavedPhrases() {
	return await fetchRest("/v1/chat/phrases").then((res) =>
		res.jsonParsed(z.object({ phrases: z.array(savedPhraseSchema) })),
	);
}

export async function createSavedPhrase({ text }: { text: string }) {
	return await fetchRest("/v1/chat/phrases", {
		method: "POST",
		body: { text },
	}).then((res) => res.jsonParsed(z.object({ phrase: savedPhraseSchema })));
}

export async function deleteSavedPhrase({ id }: { id: string }) {
	await fetchRest(`/v3/me/prefs/phrases/${encodeURIComponent(id)}`, {
		method: "DELETE",
	}).then((res) => res.assertOk());
}
