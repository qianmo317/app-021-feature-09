import { describe, expect, it } from 'vitest'
import { fairnessCSV, toCSV, weeksCSV } from '../src/lib/csv'
import { generatePlan } from '../src/lib/engine'
import { computeFairness } from '../src/lib/fairness'
import { makeClass } from './helpers'

describe('CSV 导出', () => {
  it('带 BOM 且正确转义逗号/引号/换行', () => {
    const csv = toCSV([['姓名', '备注'], ['张三', '爱说话,需关注'], ['李"四', '多行\n备注']])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('"爱说话,需关注"')
    expect(csv).toContain('"李""四"')
    expect(csv).toContain('"多行\n备注"')
  })

  it('公平性统计表与按周座位表结构完整', () => {
    const cls = makeClass({ rows: 3, cols: 4, weeks: 4, seed: 8 })
    cls.assignments = generatePlan(cls)
    const report = computeFairness(cls)
    const f = fairnessCSV(cls, report)
    expect(f[0][0]).toContain(cls.name)
    // 头部注释：口径与每个指标的算法说明都要带上
    const flat = f.map((r) => r.join(','))
    expect(flat.some((l) => l.startsWith('#') && l.includes('3 排 × 4 列'))).toBe(true)
    expect(flat.some((l) => l.includes('随机种子：8'))).toBe(true)
    expect(flat.some((l) => l.includes('位置分 Σ偏差²'))).toBe(true)
    expect(flat.some((l) => l.includes('同桌超 2 次的对'))).toBe(true)
    // 逐人表头 12 列，且其后恰好 12 行学生
    const headerIdx = f.findIndex((r) => r[0] === '姓名')
    expect(headerIdx).toBeGreaterThan(2)
    expect(f[headerIdx]).toHaveLength(12)
    const studentRows = f.slice(headerIdx + 1, headerIdx + 1 + 12)
    expect(studentRows).toHaveLength(12)
    expect(studentRows.every((r) => r.length === 12)).toBe(true)
    // 尾部列说明
    expect(flat.some((l) => l.includes('列说明：平均位置分'))).toBe(true)
    const w = weeksCSV(cls)
    expect(w.length).toBeGreaterThan(cls.assignments.length)
    // 每周都有 12 个座位记录
    for (let week = 1; week <= 4; week++) {
      expect(w.filter((r) => r[0] === week)).toHaveLength(12)
    }
  })
})
