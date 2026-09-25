import type { ClassEntity } from '../types'
import type { FairnessReport } from './fairness'
import { buildSeatIndex } from './layout'
import {
  avgScoreRangeHint,
  caliberLines,
  csvColumnNotes,
  csvHeaderComments,
  DESKMATE_DEF,
  FRONT_RANGE_DEF,
  HARD_DEF,
  HEIGHT_DEF,
  VARIANCE_DEF,
  WEEKS_DEF,
} from './metrics'

// CSV 导出（带 BOM，Excel 直接打开不乱码）
export function toCSV(rows: (string | number)[][]): string {
  const esc = (v: string | number): string => {
    const s = String(v)
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return '\uFEFF' + rows.map((r) => r.map(esc).join(',')).join('\r\n')
}

export function downloadCSV(filename: string, rows: (string | number)[][]): void {
  const blob = new Blob([toCSV(rows)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// 全班统计表（导出给家长看）：头部先放「报告口径 + 指标定义」注释，再放数据表
export function fairnessCSV(cls: ClassEntity, report: FairnessReport): (string | number)[][] {
  const rows: (string | number)[][] = []

  // —— 头部注释：这份数字是在哪套配置下、用什么算法算出来的 ——
  rows.push([`# 班级：${cls.name} · 公平性报告`])
  rows.push([`# 导出时间：${new Date().toLocaleString('zh-CN')}`])
  const groupLines: string[] = []
  for (const g of report.caliber.groups) {
    groupLines.push(...caliberLines(g))
  }
  if (!report.caliber.currentMatches) {
    groupLines.push(
      `注意：本报告主口径与班级当前配置不一致（${report.caliber.diffs
        .map((d) => `${d.label} ${d.oldV}→${d.newV}`)
        .join('；')}），以下统计仍按生成时的早先配置计算。`,
    )
  }
  rows.push(
    ...csvHeaderComments({
      caliber: groupLines,
      metrics: [WEEKS_DEF, HARD_DEF, FRONT_RANGE_DEF, VARIANCE_DEF, DESKMATE_DEF, HEIGHT_DEF],
      avgHint: avgScoreRangeHint(report.layoutRows, report.layoutCols),
    }).map((line) => [line]),
  )
  rows.push([])

  // —— 全班汇总 ——
  rows.push(['汇总指标', '数值', '说明'])
  rows.push([WEEKS_DEF.label, report.totalWeeks, WEEKS_DEF.def])
  rows.push([HARD_DEF.label, report.hardViolations.length, HARD_DEF.def])
  rows.push([FRONT_RANGE_DEF.label, report.frontRowsRange, `${FRONT_RANGE_DEF.def} ${FRONT_RANGE_DEF.good ?? ''}`])
  rows.push([VARIANCE_DEF.label, report.variance.toFixed(1), `${VARIANCE_DEF.def} ${VARIANCE_DEF.good ?? ''}`])
  rows.push([DESKMATE_DEF.label, report.deskmateOverLimit.length, DESKMATE_DEF.def])
  rows.push([
    HEIGHT_DEF.label,
    report.heightViolations,
    `${HEIGHT_DEF.def}${report.caliber.primary.snap && !report.caliber.primary.snap.heightRule ? '（生成时未启用）' : ''}`,
  ])
  rows.push([])

  // —— 逐人明细 ——
  rows.push([
    '姓名',
    '身高(cm)',
    '视力状况',
    `前${report.frontRows}排次数`,
    '前排次数',
    '中排次数',
    '后排次数',
    '中间列次数',
    '平均位置分',
    '最常同桌',
    '同桌次数',
    '重复超限(>2次)',
  ])
  const visionText = { none: '', front_required: '需前排', middle_required: '需中间' } as const
  for (const r of report.rows) {
    const top = r.deskmates[0]
    rows.push([
      r.student.name,
      r.student.heightCm ?? '',
      visionText[r.student.vision],
      r.frontRowsCount,
      r.frontCount,
      r.middleCount,
      r.backCount,
      r.middleColCount,
      r.avgScore.toFixed(2),
      top ? (cls.students.find((s) => s.id === top.studentId)?.name ?? '') : '',
      top ? top.count : 0,
      r.maxDeskmateRepeat > 2 ? `与${r.deskmates.filter((d) => d.count > 2).length}人超限` : '',
    ])
  }
  rows.push([])
  rows.push(...csvColumnNotes(report.frontRows, report.layoutCols).map((line) => [line]))
  if (report.deskmateOverLimit.length) {
    rows.push(['# 同桌超限对：', ...report.deskmateOverLimit.map((d) => `${d.a}-${d.b}(${d.count}次)`)])
  }
  return rows
}

// 按周座位表（每周一段）
export function weeksCSV(cls: ClassEntity): (string | number)[][] {
  const rows: (string | number)[][] = []
  rows.push([`班级：${cls.name}`])
  rows.push(['周次', '排', '列', '座位号', '学生', '标记'])
  const nameOf = new Map(cls.students.map((s) => [s.id, s.name]))
  const idx = buildSeatIndex(cls.seats, cls.layout)
  for (const asg of [...cls.assignments].sort((a, b) => a.week - b.week)) {
    for (const [seatId, studentId] of Object.entries(asg.map)) {
      const seat = idx.byId.get(seatId)
      if (!seat) continue
      const tagText = seat.tags.filter((t) => t !== 'middle').join('/')
      rows.push([asg.week, seat.row + 1, seat.col + 1, seat.id, nameOf.get(studentId) ?? studentId, tagText])
    }
  }
  return rows
}
