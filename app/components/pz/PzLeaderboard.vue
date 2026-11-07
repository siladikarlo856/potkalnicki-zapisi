<script setup lang="ts">
// A friend challenge's ranking as a real table: rank, nickname with its status, one column per round, the total.
// Ties share a rank and the next rank skips (1, 1, 3); the server computes it on the total, and a tied rank also
// carries a visually hidden "dijeli mjesto" so it never relies on the number alone. The visitor's own row is
// bg-accented and says "(ti)". Rows sort by rank, then finished before unfinished. Nicknames wrap, never truncate.
export interface PzLeaderboardRow {
  nickname: string
  total: number
  rank: number
  rounds: number[]
  completedAt: string | null
}

const props = defineProps<{
  rows: readonly PzLeaderboardRow[]
  /** How many round columns to show; unplayed rounds read "–". */
  roundCount: number
  /** The visitor's own nickname, if they play in this challenge. */
  me?: string | null
  /** After closing, a row that never finished reads "Nije dovršeno" instead of "U tijeku". */
  closed?: boolean
  /** The title of the challenge, for the table's accessible name. */
  caption?: string
}>()
const { t } = useI18n()

const sorted = computed(() => props.rows
  .map((row, index) => ({ row, index }))
  .sort((a, b) => a.row.rank - b.row.rank || Number(Boolean(b.row.completedAt)) - Number(Boolean(a.row.completedAt)) || a.index - b.index)
  .map(({ row }) => row))
const tied = computed(() => {
  const counts = new Map<number, number>()
  for (const row of props.rows) counts.set(row.rank, (counts.get(row.rank) ?? 0) + 1)
  return (rank: number) => (counts.get(rank) ?? 0) > 1
})
const rounds = computed(() => Array.from({ length: Math.max(props.roundCount, 0) }, (_, index) => index))

// The scoreboard reports 0 for a round that was never played, the same as a played round with no right answer.
// Only a player who has not finished can have unplayed rounds, and those come last, so for them the trailing
// zeros read "–". A finished player's zero is a real zero.
function played(row: PzLeaderboardRow, index: number): number | undefined {
  const points = row.rounds[index]
  if (points === undefined) return undefined
  if (row.completedAt || points > 0) return points
  return row.rounds.slice(index).some(value => value > 0) ? points : undefined
}

function status(row: PzLeaderboardRow) {
  if (row.completedAt) return { key: 'completed', icon: 'i-lucide-check', tone: 'text-success' }
  if (props.closed) return { key: 'incomplete', icon: 'i-lucide-clock', tone: 'text-muted' }
  return { key: 'inProgress', icon: 'i-lucide-clock', tone: 'text-primary' }
}
</script>

<template>
  <table
    class="w-full border-separate border-spacing-0 text-[15px]/5"
    data-testid="challenge-leaderboard"
  >
    <caption class="sr-only">
      {{ caption ?? t('pz.board.caption') }}
    </caption>
    <thead>
      <tr>
        <th
          scope="col"
          class="pz-overline border-b border-accented p-2 text-start text-muted"
        >
          {{ t('pz.board.rank') }}
        </th>
        <th
          scope="col"
          class="pz-overline border-b border-accented p-2 text-start text-muted"
        >
          {{ t('pz.board.player') }}
        </th>
        <th
          v-for="index in rounds"
          :key="index"
          scope="col"
          class="pz-overline border-b border-accented p-2 text-end text-muted"
        >
          <span aria-hidden="true">R{{ index + 1 }}</span>
          <span class="sr-only">{{ t('challenge.round', { number: index + 1 }) }}</span>
        </th>
        <th
          scope="col"
          class="pz-overline border-b border-accented p-2 text-end text-muted"
        >
          <span aria-hidden="true">Σ</span>
          <span class="sr-only">{{ t('pz.board.total') }}</span>
        </th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="row in sorted"
        :key="row.nickname"
        :data-me="me === row.nickname ? 'true' : undefined"
        data-testid="challenge-leaderboard-row"
        class="*:border-b *:border-default *:px-2 *:py-2.5 *:align-middle *:tabular-nums data-[me=true]:*:bg-accented"
      >
        <td
          class="w-9 pz-h3 font-sans font-bold"
          data-testid="challenge-rank"
        >
          {{ row.rank }}<span
            v-if="tied(row.rank)"
            class="sr-only"
          > ({{ t('pz.board.tied') }})</span>
        </td>
        <th
          scope="row"
          class="min-w-0 text-start font-normal wrap-anywhere"
        >
          <b class="font-semibold text-highlighted">{{ row.nickname }}</b>
          <span
            v-if="me === row.nickname"
            class="text-muted"
          > ({{ t('pz.board.you') }})</span>
          <br>
          <span
            class="inline-flex items-center gap-1 text-xs/4 font-medium whitespace-nowrap"
            :class="status(row).tone"
          >
            <UIcon
              :name="status(row).icon"
              class="size-3"
            />
            {{ t(`challenge.${status(row).key}`) }}
          </span>
        </th>
        <td
          v-for="index in rounds"
          :key="index"
          class="text-end"
          :class="played(row, index) === undefined ? 'text-muted' : ''"
        >
          {{ played(row, index) ?? '–' }}
        </td>
        <td class="text-end font-bold text-highlighted">
          {{ row.total }}
        </td>
      </tr>
    </tbody>
  </table>
</template>
