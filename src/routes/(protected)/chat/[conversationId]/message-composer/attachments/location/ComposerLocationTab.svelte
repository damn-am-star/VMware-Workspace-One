<script lang="ts">
	import { untrack } from "svelte";

	import { preferencesSnapshot } from "$lib/app-data/preferences.svelte";
	import { PIN_ZOOM } from "$lib/components/location-chooser/constants";
	import Spinner from "$lib/components/ui/spinner/spinner.svelte";
	import { autoLocation } from "$lib/location/auto-location";
	import {
		type Coordinates,
		locationRequest,
	} from "$lib/location/location-request.svelte";
	import { decodeGeohash } from "$lib/model/geohash";
	import { draftFromMessage } from "$lib/model/messaging/messages";
	import type GeoMapPickerComponent from "$lib/components/location-chooser/GeoMapPicker.svelte";
	import { getMessageComposerContext } from "../../message-composer-context.svelte";
	import type { TabSelection } from "../tabs";

	let {
		onClose,
		onSelectionChange,
	}: {
		onClose: () => void;
		onSelectionChange: (selection: TabSelection) => void;
	} = $props();

	const composer = getMessageComposerContext();
	let pinPos = $state<Coordinates | undefined>(
		untrack(() => {
			const geohash = preferencesSnapshot().geohash;
			if (!geohash) return undefined;
			const { lat, lon } = decodeGeohash(geohash);
			return { lat, lon };
		}),
	);
	const initialPosition = untrack(() => pinPos);
	let picker: GeoMapPickerComponent | null = $state(null);

	$effect(() => {
		if (picker && initialPosition)
			picker.centerAt({ ...initialPosition, zoom: PIN_ZOOM });
	});

	$effect(() => {
		onSelectionChange({ count: pinPos ? 1 : 0, label: "Send location" });
	});

	$effect(() => {
		autoLocation.suspend();
		return () => {
			locationRequest.abort();
			autoLocation.resume();
		};
	});

	export function submitSelection() {
		if (!pinPos || composer().disabled) return;
		const { lat, lon } = pinPos;
		onClose();
		void composer().sendMessages([
			draftFromMessage({ type: "Location", body: { lat, lon } }),
		]);
	}
</script>

<p class="mb-3 text-sm text-muted-foreground">
	Choose a point on the map to share.
</p>
<div
	class="relative h-[55vh] w-full overflow-hidden rounded-lg"
	data-vaul-no-drag
>
	{#await import("$lib/components/location-chooser/GeoMapPicker.svelte")}
		<div class="flex h-full items-center justify-center">
			<Spinner class="size-8" />
		</div>
	{:then { default: GeoMapPicker }}
		<GeoMapPicker bind:pinPos bind:this={picker} />
	{/await}
</div>
