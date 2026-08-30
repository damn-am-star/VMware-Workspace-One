<script lang="ts">
	import type { LocationMessage } from "$lib/model/messaging/messages";
	import MessageBubble from "./MessageBubble.svelte";
    import { MapPinIcon } from "phosphor-svelte";

	let { message }: { message: LocationMessage["body"] } = $props();
</script>

<MessageBubble tone="sent">
	<span class="wrap-anywhere whitespace-pre-wrap">
        <MapPinIcon weight="fill" />
        Location shared
    </span>
</MessageBubble>
