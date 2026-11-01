// Page views are tracked everywhere except the admin area (also under the /en prefix).
export function shouldTrackPath(path: string): boolean {
  return !/^(\/en)?\/admin(\/|$)/.test(path)
}
