import { describe, expect, it } from 'vitest'
import { formatSkillDisplayName, pickQuickSkills, resolveDefaultSkillId } from '@/features/chat/utils/skill'

describe('chat skill utils', () => {
  const skills = [
    { id: 'wave_theory', name: '波浪理论', description: '波段分析' },
    { id: 'bull_trend', name: '趋势策略', description: '趋势跟随' },
    { id: 'custom_skill', name: '自定义策略', description: '实验策略' },
    { id: 'chan_theory', name: '缠论', description: '中枢分析' },
  ]

  it('resolves default skill with preferred id', () => {
    expect(resolveDefaultSkillId(skills, 'chan_theory')).toBe('chan_theory')
    expect(resolveDefaultSkillId(skills, 'missing')).toBe('wave_theory')
    expect(resolveDefaultSkillId([], 'bull_trend')).toBe('')
  })

  it('picks quick skills with preferred order first', () => {
    expect(pickQuickSkills(skills, 3).map((skill) => skill.id)).toEqual(['bull_trend', 'chan_theory', 'wave_theory'])
    expect(pickQuickSkills(skills, 10)).toHaveLength(4)
    expect(pickQuickSkills([], 4)).toEqual([])
  })

  it('formats default-prefixed skill names for display', () => {
    expect(formatSkillDisplayName('默认多头趋势')).toBe('多头趋势')
    expect(formatSkillDisplayName('默认 多头趋势')).toBe('多头趋势')
    expect(formatSkillDisplayName('缠论')).toBe('缠论')
  })
})
