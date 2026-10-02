export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const limit = Math.min(Number(query.limit) || 10, 50)
  const range = resolveDateRangeFromQuery(query)
  const scope = requireReportStore(event, query.store)
  const storeIds = scope.mode === 'all' ? scope.stores.map((store) => store.id) : [scope.store.id]

  return getTopProducts(range, storeIds, limit)
})
