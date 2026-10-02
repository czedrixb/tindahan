<script setup lang="ts">
const { session } = useSession()

// titleTemplate needs a function, which nuxt.config's serializable app.head
// can't carry (see the comment there) - set once here instead.
useHead({
  titleTemplate: (title) => (title && title !== 'Tindahan' ? `${title} · Tindahan` : 'Tindahan'),
})
</script>

<template>
  <NuxtLayout>
    <!-- Store-scoped pages use a mix of useFetch and imperative loaders. A
         store change must remount the current page so both styles reload
         against the newly selected store without a browser refresh. -->
    <NuxtPage :key="session?.activeStore?.id ?? 'anonymous'" />
  </NuxtLayout>
  <AppSplash />
  <!-- @vite-pwa/nuxt only auto-registers this component; it never renders it
       for you. Without it the manifest is generated and servable but never
       linked from the document head, so the app is never installable. -->
  <VitePwaManifest />
</template>
