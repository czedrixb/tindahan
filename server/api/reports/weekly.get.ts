export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const date = typeof query.date === 'string' ? new Date(query.date) : new Date()
  if (Number.isNaN(date.getTime())) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid date' })
  }

  const range = storeWeekRange(date)
  const scope = requireReportStore(event, query.store)
  const storeIds = scope.mode === 'all' ? scope.stores.map((store) => store.id) : [scope.store.id]
  const totals = await getSalesTotals(range, storeIds)
  const topProducts = await getTopProducts(range, storeIds, 5)
  const series = await getDailySeries(range, storeIds)

  return {
    start: storeDateKey(range.start),
    end: storeDateKey(new Date(range.end.getTime() - 24 * 60 * 60 * 1000)),
    ...totals,
    series,
    topProducts,
    scope: scope.mode === 'all' ? 'all' : String(scope.store.id),
  }
})
