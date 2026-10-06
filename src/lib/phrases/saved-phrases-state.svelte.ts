import { accountScoped } from "$lib/api/account-caches";
import {
	createSavedPhrase,
	deleteSavedPhrase,
	getSavedPhrases,
	type SavedPhrase,
} from "$lib/api/messaging/phrases";
import {
	hydratePreferences,
	preferencesSnapshot,
	setPreferences,
} from "$lib/app-data/preferences.svelte";
import { moveItem } from "$lib/util/reorder";

export function orderPhrases(
	phrases: SavedPhrase[],
	order: string[],
): SavedPhrase[] {
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- temporary lookup rebuilt on each reconciliation
	const remaining = new Map(phrases.map((phrase) => [phrase.id, phrase]));
	const ordered: SavedPhrase[] = [];
	for (const id of order) {
		const phrase = remaining.get(id);
		if (!phrase) continue;
		ordered.push(phrase);
		remaining.delete(id);
	}
	return [...ordered, ...remaining.values()];
}

export class SavedPhrasesState {
	phrases = $state<SavedPhrase[] | null>(null);
	error = $state<unknown>(null);
	pending = $state(false);
	// This account state outlives screens; compute in the caller's reactive context.
	get ordered(): SavedPhrase[] | null {
		return this.phrases === null
			? null
			: orderPhrases(
					this.phrases,
					preferencesSnapshot().savedPhraseOrder,
				);
	}

	#generation = 0;
	#destroyed = false;
	#refreshing: { generation: number; done: Promise<void> } | null = null;

	refresh(): Promise<void> {
		if (this.#destroyed || this.pending) return Promise.resolve();
		if (this.#refreshing?.generation === this.#generation)
			return this.#refreshing.done;
		const generation = this.#generation;
		this.error = null;
		const done = this.#load(generation).finally(() => {
			if (this.#refreshing?.done === done) this.#refreshing = null;
		});
		this.#refreshing = { generation, done };
		return done;
	}

	async #load(generation: number): Promise<void> {
		try {
			const [{ phrases }] = await Promise.all([
				getSavedPhrases(),
				hydratePreferences(),
			]);
			if (generation !== this.#generation || this.#destroyed) return;
			this.phrases = phrases;
		} catch (error) {
			if (generation !== this.#generation || this.#destroyed) return;
			this.error = error;
		}
	}

	add(text: string): Promise<boolean> {
		const trimmed = text.trim();
		if (!trimmed) return Promise.resolve(false);
		return this.#change(async () => {
			const { phrase } = await createSavedPhrase({ text: trimmed });
			return [...(this.phrases ?? []), phrase];
		});
	}

	remove(id: string): Promise<boolean> {
		return this.#change(async () => {
			await deleteSavedPhrase({ id });
			return this.phrases?.filter((phrase) => phrase.id !== id) ?? [];
		});
	}

	move(from: number, to: number): Promise<boolean> {
		return this.#change(async () => {
			const ordered = moveItem({ items: this.ordered ?? [], from, to });
			await setPreferences({
				savedPhraseOrder: ordered.map(({ id }) => id),
			});
			return this.phrases ?? [];
		});
	}

	async #change(task: () => Promise<SavedPhrase[]>): Promise<boolean> {
		if (this.#destroyed || this.pending || this.phrases === null)
			return false;
		this.pending = true;
		this.#generation += 1;
		try {
			const phrases = await task();
			if (this.#destroyed) return false;
			this.phrases = phrases;
			return true;
		} catch (error) {
			if (this.#destroyed) return false;
			throw error;
		} finally {
			this.#generation += 1;
			this.pending = false;
		}
	}

	destroy(): void {
		this.#destroyed = true;
		this.#generation += 1;
		this.phrases = null;
		this.error = null;
	}
}

export const getSavedPhrasesState = accountScoped(
	() => new SavedPhrasesState(),
);
