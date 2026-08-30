import { untrack } from "svelte";
import type z from "zod";

import { registerAccountCache } from "$lib/api/account-caches";
import { showErrorToast } from "$lib/api/error-toast";
import type { rightNowV4QuerySchema } from "$lib/model/right-now/feed/query/v4";
import { type FeedPost, getPosts } from "./posts";
import { RightNowSearchFiltersState } from "./right-now-filters-state.svelte";

class RightNowState {
	filters = new RightNowSearchFiltersState({
		onQueryChange: () => {
			console.log(11);
			this.refresh();
		},
	});
	posts: FeedPost[] = $state([]);
	loading = $state(false);
	refreshing = $state(false);
	error: Error | null = $state(null);
	currentQuery: z.infer<typeof rightNowV4QuerySchema> | null = null;
	scrollY = 0;

	#fetchToken = 0;

	get errorMessage(): string | null {
		return this.error?.message ?? null;
	}

	load(): void {
		if (untrack(() => this.posts.length > 0)) return;
		this.#reset();
		this.scrollY = 0;
		void this.#fetchPosts();
	}

	refresh(): void {
		this.#reset();
		this.scrollY = 0;
		void this.#fetchPosts();
	}

	async reload(): Promise<void> {
		if (this.refreshing) return;
		this.refreshing = true;
		try {
			await this.#fetchPosts(true);
		} finally {
			this.refreshing = false;
		}
	}

	#reset(): void {
		this.posts = [];
		this.loading = true;
		this.error = null;
	}

	reset(): void {
		this.#fetchToken += 1;
		this.#reset();
		this.loading = false;
		this.refreshing = false;
		this.scrollY = 0;
		this.filters.reset();
	}

	async #fetchPosts(silent = false): Promise<void> {
		const token = ++this.#fetchToken;
		try {
			await this.filters.ready;
			if (token !== this.#fetchToken) return;
			const filters = this.filters.value;
			const query = {
				sort: filters?.sort || "DISTANCE",
				...(filters?.hostingEnabled && { hosting: filters?.hosting }),
				...(filters?.positionEnabled && {
					sexualPositions: filters?.positions,
				}),
				...(filters?.ageEnabled && {
					ageMin: filters?.age[0],
					ageMax: filters?.age[1],
				}),
			} satisfies z.infer<typeof rightNowV4QuerySchema>;
			const posts = await getPosts(query);
			if (token !== this.#fetchToken) return;
			this.currentQuery = query;
			this.posts = posts;
			this.error = null;
			this.loading = false;
		} catch (err) {
			if (token !== this.#fetchToken) return;
			console.error(err);
			this.loading = false;
			if (silent) {
				showErrorToast({
					label: "Failed to refresh Right Now feed",
					error: err,
				});
				return;
			}
			this.error =
				err instanceof Error
					? err
					: new Error("Failed to fetch Right Now feed", {
							cause: err,
						});
		}
	}
}

export const rightNowState = new RightNowState();

registerAccountCache({ reset: () => rightNowState.reset() });
