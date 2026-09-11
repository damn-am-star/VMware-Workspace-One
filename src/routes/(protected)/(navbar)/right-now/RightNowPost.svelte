<script lang="ts">
	import {
		ChatIcon,
		ClockIcon,
		HouseIcon,
		NavigationArrowIcon,
	} from "phosphor-svelte";
	import { untrack } from "svelte";

	import { getPreferencesSnapshot } from "$lib/app-data/preferences.svelte";
	import DistanceFormatted from "$lib/components/profile/DistanceFormatted.svelte";
	import MediaImage from "$lib/components/shared/MediaImage.svelte";
	import RelativeTimeDynamic from "$lib/components/shared/RelativeTimeDynamic.svelte";
	import Button from "$lib/components/ui/button/button.svelte";
	import { proxyMediaUrl } from "$lib/util/media";
	import { formatDistance } from "$lib/util/units";
	import type { FeedPostMedia } from "$lib/right-now/posts";
	import RightNowAvatar from "./RightNowAvatar.svelte";

	let {
		profileId,
		mediaHash = null,
		onlineUntil = null,
		text = null,
		displayName = null,
		media,
		posted,
		distance = null,
		hosting = false,
		ourProfileId,
	}: {
		profileId: number;
		mediaHash: string | null;
		onlineUntil: number | null;
		text: string | null;
		displayName: string | null;
		media: FeedPostMedia[];
		posted: number;
		distance: number | null;
		hosting: boolean;
		ourProfileId: number;
	} = $props();

	const conversationId = $derived(
		[profileId, ourProfileId].toSorted((a, b) => a - b).join(":"),
	);

	interface ImageState {
		width: number | undefined;
		height: number | undefined;
		loaded: boolean;
	}

	let mediaStates = $state<ImageState[]>(
		untrack(() =>
			media.map(() => ({
				width: undefined,
				height: undefined,
				loaded: false,
			})),
		),
	);

	$effect(() => {
		const targetLength = media.length;
		untrack(() => {
			if (mediaStates.length !== targetLength) {
				mediaStates = media.map((_, i) => {
					return (
						mediaStates[i] ?? {
							width: undefined,
							height: undefined,
							loaded: false,
						}
					);
				});
			}
		});
	});

	const units = $derived(getPreferencesSnapshot().units);

	const postAriaLabel = $derived.by(() => {
		let label = `Post by ${displayName ? displayName : "someone"}.`;
		if (text !== null) {
			label += `With message.`;
		}
		if (distance !== null) {
			label += `Distance: ${formatDistance(distance, units)}.`;
		}
		return label;
	});
</script>

<article
	class="flex w-full gap-4 text-muted-foreground"
	aria-label={postAriaLabel}
>
	<div>
		<RightNowAvatar {profileId} {displayName} {mediaHash} {onlineUntil} />
	</div>
	<div class="w-full">
		<div class={["mt-1 font-bold wrap-break-word", { "text-white": text }]}>
			{text ? text : displayName ? `${displayName} joined` : "Joined"}
		</div>
		{#if media.length}
			<div class="mt-2 flex flex-col items-start gap-1">
				{#each media as image (image.fullImageUrl)}
					<MediaImage
						src={proxyMediaUrl(image.thumbnailUrl)}
						loading="lazy"
						aspectRatio="1 / 1"
						class="w-full max-w-3xs rounded-md"
					/>
				{/each}
			</div>
		{/if}
		<div class="flex justify-between">
			<div class="flex items-center gap-1 text-xs leading-none">
				<ClockIcon class="inline-block size-3" aria-hidden="true" />
				<span class="sr-only">Posted:</span>
				<RelativeTimeDynamic date={posted} />
				{#if distance !== null}
					<NavigationArrowIcon
						class="ms-1 inline-block size-3 -scale-x-100"
						aria-hidden="true"
					/>
					<span class="sr-only">Distance:</span>
					<DistanceFormatted {distance} />
				{/if}
				{#if hosting}
					<HouseIcon
						class="ms-1 inline-block size-3 text-fuchsia-700"
						weight="fill"
						aria-hidden="true"
					/>
					<span class="sr-only">Hosting</span>
				{/if}
			</div>
			<div>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					href="/chat/{conversationId}"
					aria-label="Message {displayName
						? `${displayName}`
						: 'someone'}"
				>
					<ChatIcon
						class="inline-block size-4 align-text-top"
						aria-hidden="true"
					/>
				</Button>
			</div>
		</div>
	</div>
</article>
