<script lang="ts">
	import { PencilIcon } from "phosphor-svelte";

	import { Button } from "$lib/components/ui/button";
</script>

<Button
	size="sm"
	href="/settings/profile"
	variant="secondary"
	aria-label="Edit profile"
	class="h-8 text-base"
>
	<PencilIcon class="size-6" />
	Edit profile
</Button>
