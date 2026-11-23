const pending = new Map<number, Promise<undefined>>()

export async function withSubmissionLock<T>(id: number, action: () => Promise<T>): Promise<T> {
  const previous = pending.get(id) ?? Promise.resolve(undefined)
  const { promise: current, resolve: release } = Promise.withResolvers<undefined>()
  pending.set(id, current)
  await previous
  try {
    return await action()
  } finally {
    release(undefined)
    if (pending.get(id) === current) pending.delete(id)
  }
}
