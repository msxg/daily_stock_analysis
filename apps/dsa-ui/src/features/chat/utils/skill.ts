import type { ChatSkill } from '@/shared/types/chat'

const PREFERRED_SKILL_ORDER = ['bull_trend', 'chan_theory', 'wave_theory', 'box_oscillation', 'emotion_cycle']

export function formatSkillDisplayName(name: string | null | undefined): string {
  const trimmed = String(name || '').trim()
  if (!trimmed) return ''
  return trimmed.replace(/^默认\s*/, '')
}

export function resolveDefaultSkillId(skills: ChatSkill[], preferredId?: string): string {
  if (preferredId && skills.some((skill) => skill.id === preferredId)) {
    return preferredId
  }
  return skills[0]?.id || ''
}

export function pickQuickSkills(skills: ChatSkill[], maxCount = 4): ChatSkill[] {
  if (!skills.length || maxCount <= 0) return []

  const preferred = PREFERRED_SKILL_ORDER.map((id) => skills.find((skill) => skill.id === id)).filter(
    (skill): skill is ChatSkill => !!skill,
  )
  const remaining = skills.filter((skill) => !preferred.some((item) => item.id === skill.id))
  return [...preferred, ...remaining].slice(0, maxCount)
}
