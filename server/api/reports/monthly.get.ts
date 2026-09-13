export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const date = typeof query.date === 'string' ? new Date(query.date) : new Date()
  if (Number.isNaN(date.getTime())) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid date' })
  }

  const range = storeMonthRange(date)
  const totals = await getSalesTotals(range)
  const topProducts = await getTopProducts(range, 10)
  const lowestStock = await getLowestStockProducts(10)
  const series = await getDailySeries(range)

  return {
    start: storeDateKey(range.start),
    end: storeDateKey(new Date(range.end.getTime() - 24 * 60 * 60 * 1000)),
    ...totals,
    series,
    topProducts,
    lowestStock,
  }
})
