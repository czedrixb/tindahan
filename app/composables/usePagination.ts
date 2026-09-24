export function usePagination<T>(items: MaybeRefOrGetter<readonly T[]>, pageSize = 10) {
  const currentPage = ref(1)
  const source = computed(() => toValue(items))
  const totalPages = computed(() => Math.max(1, Math.ceil(source.value.length / pageSize)))
  const pageItems = computed(() => {
    const start = (currentPage.value - 1) * pageSize
    return source.value.slice(start, start + pageSize)
  })

  watch(totalPages, (pages) => {
    if (currentPage.value > pages) currentPage.value = pages
  })

  function setPage(page: number) {
    currentPage.value = Math.min(Math.max(1, page), totalPages.value)
  }

  function resetPage() {
    currentPage.value = 1
  }

  return { currentPage, totalPages, pageItems, setPage, resetPage }
}
