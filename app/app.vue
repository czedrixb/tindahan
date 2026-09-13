<script setup lang="ts">
// titleTemplate needs a function, which nuxt.config's serializable app.head
// can't carry (see the comment there) - set once here instead.
useHead({
  titleTemplate: (title) => (title && title !== 'Tindahan' ? `${title} · Tindahan` : 'Tindahan'),
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <AppSplash />
  <!-- @vite-pwa/nuxt only auto-registers this component; it never renders it
       for you. Without it the manifest is generated and servable but never
       linked from the document head, so the app is never installable. -->
  <VitePwaManifest />
</template>
