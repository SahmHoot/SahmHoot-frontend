export const REACTION_EMOJIS = ['👍', '❓', '😀', '👏'] as const

export type Reaction = typeof REACTION_EMOJIS[number]
export type ReactionStats = Record<Reaction, number>

export interface FloatingReaction {
  id: string
  emoji: Reaction
  expiresAt: number
  lane: number
}

export const REACTION_DURATION_MS = 1_800

export function isReaction(value: unknown): value is Reaction {
  return REACTION_EMOJIS.some((emoji) => emoji === value)
}

export function isReactionStats(value: unknown): value is ReactionStats {
  if (typeof value !== 'object' || value === null) return false
  const counts = value as Record<string, unknown>
  return REACTION_EMOJIS.every((emoji) => {
    const count = counts[emoji]
    return typeof count === 'number' && Number.isSafeInteger(count) && count >= 0
  })
}
