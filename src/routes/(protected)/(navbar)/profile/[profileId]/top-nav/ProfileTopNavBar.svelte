<script lang="ts">
	import { ArrowLeftIcon } from "phosphor-svelte";

	import { Button } from "$lib/components/ui/button";
	import EditProfileButton from "./EditProfileButton.svelte";
	import FavoriteProfileToggle from "./FavoriteProfileToggle.svelte";
	import ProfileActionsMenu from "./ProfileActionsMenu.svelte";

	let {
		ourProfileId,
		profile,
		darkBackground = false,
		onBlocked,
		onHidden,
		onFavorite,
	}: {
		ourProfileId: number;
		profile: import("$lib/model/users/profiles").Profile;
		darkBackground: boolean;
		onBlocked: () => void;
		onHidden: () => void;
		onFavorite: (isFavorite: boolean) => void;
	} = $props();

	const profileId = $derived(profile.profileId);
	const isOurProfile = $derived(profileId === ourProfileId);
</script>

<nav
	class={[
		"fixed top-0 z-1 mx-auto flex w-full max-w-200 flex-row items-center justify-between gap-1.5 bg-linear-to-b px-2 pt-(--safe-area-top) pb-4 ",
		{ "from-black to-transparent": !darkBackground },
		{ "from-black via-black to-transparent": darkBackground },
	]}
>
	<div>
		<Button
			size="icon-lg"
			onclick={() => history.back()}
			variant="ghost"
			aria-label="Back"
		>
			<ArrowLeftIcon class="size-6" />
		</Button>
	</div>
	<div class="flex flex-row-reverse items-center gap-1.5">
		{#if isOurProfile}
			<EditProfileButton />
		{:else}
			<FavoriteProfileToggle
				{profileId}
				isFavorite={profile.isFavorite}
				{onFavorite}
			/>
			<ProfileActionsMenu {profileId} {onBlocked} {onHidden} />
		{/if}
	</div>
</nav>
