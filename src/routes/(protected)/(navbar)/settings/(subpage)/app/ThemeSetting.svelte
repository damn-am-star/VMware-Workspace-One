<script lang="ts">
	import { showErrorToast } from "$lib/api/error-toast";
	import {
		getPreferencesSnapshot,
		setPreferences,
	} from "$lib/app-data/preferences.svelte";
	import * as Item from "$lib/components/ui/item";
	import * as ToggleGroup from "$lib/components/ui/toggle-group";
	import type { Theme } from "$lib/util/themes";

	let pending = $state<Theme | null>(null);
	const value = $derived(pending ?? getPreferencesSnapshot().theme);
</script>

<Item.Root variant="outline" class="gap-3 p-4">
	<Item.Content class="gap-1">
		<Item.Title>Theme</Item.Title>
		<Item.Description>Choose the application theme</Item.Description>
	</Item.Content>
	<ToggleGroup.Root
		type="single"
		variant="outline"
		class="w-full"
		bind:value={
			() => value,
			(next: string) => {
				const theme = (next || "classic") as Theme;
				pending = theme;
				setPreferences({ theme }).catch((error) => {
					pending = null;
					showErrorToast({
						label: "Failed to save preferences",
						error,
					});
				});
			}
		}
	>
		<ToggleGroup.Item value="classic" class="flex-1 justify-center">
			Classic
		</ToggleGroup.Item>
		<ToggleGroup.Item value="sky" class="flex-1 justify-center">
			Sky
		</ToggleGroup.Item>
	</ToggleGroup.Root>
</Item.Root>
