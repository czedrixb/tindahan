export default defineEventHandler(async (event) => {
  const user = await resolveSessionUser(event)
  if (!user) return { authenticated: false, user: null, stores: [], activeStore: null }
  const { stores, activeStore, ...sessionUser } = user
  return { authenticated: true, user: sessionUser, stores, activeStore }
})
