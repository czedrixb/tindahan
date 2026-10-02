export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const date = typeof query.date === 'string' ? new Date(query.date) : new Date()
  if (Number.isNaN(date.getTime())) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid date' })
  }

  const range = storeDayRange(date)
  const scope = requireReportStore(event, query.store)
  const storeIds = scope.mode === 'all' ? scope.stores.map((store) => store.id) : [scope.store.id]
  const totals = await getSalesTotals(range, storeIds)

  return { date: storeDateKey(date), scope: scope.mode === 'all' ? 'all' : String(scope.store.id), ...totals }
})
