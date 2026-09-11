import { showErrorToast } from "$lib/api/error-toast";
import {
	getPreferences,
	setPreferences,
} from "$lib/app-data/preferences.svelte";
import {
	defaultRightNowFilters,
	type RightNowFilters,
} from "$lib/model/right-now/filters";
import { deepEqual } from "$lib/util/deep-equal";

export class RightNowSearchFiltersState {
	value: RightNowFilters | null = $state(null);
	onQueryChange: () => void;
	ready: Promise<void>;

	constructor({ onQueryChange }: { onQueryChange: () => void }) {
		this.onQueryChange = onQueryChange;
		this.ready = this.#load();
	}

	snapshot(): RightNowFilters {
		return { ...(this.value ?? defaultRightNowFilters) };
	}

	set(rightNowFilters: Partial<RightNowFilters>) {
		const oldValue = this.value;
		const newValue = Object.assign({}, oldValue, rightNowFilters);

		if (!deepEqual(oldValue, newValue)) {
			this.value = newValue;
			void this.#save();
			this.onQueryChange();
		}
	}

	reset() {
		this.set({ ...defaultRightNowFilters });
	}

	async #load() {
		try {
			const { rightNowFilters } = await getPreferences();
			this.value = rightNowFilters ?? defaultRightNowFilters;
		} catch (error) {
			console.error(error);
			showErrorToast({ label: "Failed to load filters", error });
		}
	}

	async #save() {
		try {
			if (this.value !== null) {
				await setPreferences({ rightNowFilters: this.value });
			}
		} catch (error) {
			console.error(error);
			showErrorToast({ label: "Failed to update filters", error });
		}
	}
}
