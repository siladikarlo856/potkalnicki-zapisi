export const CORRECTION_TARGET_REF_MAX = 120
export const CORRECTION_TARGET_REF_PATTERN = /^[a-z0-9-]+$/

export function isCorrectionTargetRefFormat(value: string) {
  return value.length >= 1
    && value.length <= CORRECTION_TARGET_REF_MAX
    && CORRECTION_TARGET_REF_PATTERN.test(value)
}
