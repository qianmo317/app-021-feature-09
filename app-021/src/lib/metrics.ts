import type { GenSnapshot } from '../types'
import type { ReportConfigGroup } from './fairness'
import { middleColSet } from './layout'

// ================= 报告口径文案（页面与 CSV 共用，保证拿出去说法一致） =================

export interface MetricDef {
  key: string
  label: string // 指标名
  def: string // 定义与算法（给家长/年级组长看）
  good?: string // 怎样算好（可选）
}

// 汇总卡片：统计周数
export const WEEKS_DEF: MetricDef = {
  key: 'weeks',
  label: '统计周数',
  def: '纳入本次统计的座位表周数（每生成一周算 1），下面所有「次数」都是在这些周里累计的。',
}

// 汇总卡片：硬约束违反
export const HARD_DEF: MetricDef = {
  key: 'hard',
  label: '硬约束违反',
  def: '逐条核对每位学生的视力（需前排/需中间列）、听力（前一半排）、行动不便（靠过道）、固定座位，以及「必须分开」的学生是否被排成同桌；违反 1 条记 1 次。',
  good: '必须为 0；正常由引擎生成的结果恒为 0，只有手工改动历史数据才可能出现。',
}

// 汇总卡片：前排次数极差（N 在生成时配置里取）
export const FRONT_RANGE_DEF: MetricDef = {
  key: 'front-range',
  label: '前排次数极差',
  def: '统计每人坐在「前 N 排」的周数，取全班最大值减最小值。N 取生成时配置的前排数（见上方「报告口径」）。',
  good: '越小越公平，目标 ≤ 3：即坐前排最多与最少的人相差不超过 3 次。',
}

// 汇总卡片：位置分 Σ偏差²
export const VARIANCE_DEF: MetricDef = {
  key: 'variance',
  label: '位置分 Σ偏差²',
  def: '先把每人在各周的位置分累加，得到累计分；再算 Σ(个人累计分 − 全班平均累计分)²，即「每人累计位置分与平均分之差的平方和」。',
  good: '越小越平：0 表示每个人累计位置分完全相同；数值越大说明好位置越集中在少数人身上。',
}

// 汇总卡片：同桌超限对
export const DESKMATE_DEF: MetricDef = {
  key: 'deskmate',
  label: '同桌超 2 次的对',
  def: '逐周把「同桌」（行列模式为同排相邻且中间无过道；小组模式为同组 4 人）按无向两人对去重计数，统计累计同桌超过 2 次（即 ≥ 3 次）的学生对数量。',
  good: '目标为 0：任意两人整学期同桌不超过 2 次。',
}

// 汇总卡片：身高序违背
export const HEIGHT_DEF: MetricDef = {
  key: 'height',
  label: '身高序违背',
  def: '同一列中，前一排学生身高高于后一排学生，记 1 次（按周累加；仅在生成时开启「高个靠后」且为行列排座时统计）。',
  good: '0 表示始终矮个在前、高个在后。该条为软目标，引擎尽量满足但允许少量违背。',
}

export const METRIC_DEFS = [WEEKS_DEF, HARD_DEF, FRONT_RANGE_DEF, VARIANCE_DEF, DESKMATE_DEF, HEIGHT_DEF]

// 逐人表格列定义
export const COL_NAME_DEF = '学生姓名。'
export const COL_HEIGHT_DEF = '学生身高（厘米），用于「高个靠后」排序；未填写显示 —。'
export const COL_VISION_DEF = '视力需求：需前排＝必须坐前 N 排；需中间＝不坐最边列；—＝无特殊需求。'
export function colFrontRowsDef(frontRows: number): string {
  return `坐在第 1～${frontRows} 排的周数（前排按前 ${frontRows} 排计，N 取自生成时配置）；全班极差见上方汇总卡片。`
}
export const COL_THIRDS_DEF =
  '前/中/后周数：把全部排数三等分（向上取整），第 1 个 1/3 为前排、最后 1/3 为后排、其余为中排；用于条形图展示，与「前 N 排次数」不是同一个口径。'
export function colMiddleColDef(cols: number): string {
  const n = middleColSet({ rows: 1, cols, aisles: [], mode: 'rows', doorSide: 'right' }).size
  return `坐在教室正中连续 ${n} 列（以中轴为中心、跨度约为列宽一半的连续列）的周数。`
}
export const COL_AVG_DEF =
  '平均位置分 = 该生各周位置分之和 ÷ 统计周数。位置分 = 前后排权重 + 中间度权重：' +
  '前后排权重 ∈ [0,2]，第 1 排为 0、最后一排为 2，按 排号/(总排数−1)×2 线性取值；' +
  '中间度权重 ∈ [0,1]，正中一列为 0、最边列为 1，按到中轴距离线性取值。' +
  '分数越低位置越好；理论范围 0（第 1 排正中）～ 3（最后一排最边上），全班平均值可作对照线。'
export function avgScoreRangeHint(rows: number, cols: number): string {
  return `本教室（${rows} 排 × ${cols} 列）理论范围：第 1 排正中 0 ～ 第 ${rows} 排最边列 3；低于全班平均说明整体坐得更靠前/居中。`
}
export const COL_TOPDESK_DEF = '与该生同桌次数最多的同学；同桌＝同排相邻且中间无过道（小组模式为同组成员）。'
export const COL_DESKCOUNT_DEF = '该生与「最常同桌」整学期同桌的周数，目标 ≤ 2。'
export const COL_WARN_DEF = '最常同桌超过 2 次时提示「同桌超限」，否则打勾。'

// 汇总口径描述行（UI 卡片与 CSV 头部共用）
const MODE_TEXT: Record<GenSnapshot['mode'], string> = { rows: '行列排座', groups: '小组围坐' }

export function caliberLines(g: ReportConfigGroup): string[] {
  if (g.legacy || !g.snap) {
    return [
      `统计周次：第 ${g.weeks[0]}～${g.weeks[g.weeks.length - 1]} 周（共 ${g.weeks.length} 周）`,
      '生成口径：早期版本数据，未记录生成时配置，下列数字按班级当前配置回溯计算。',
    ]
  }
  const s = g.snap
  return [
    `统计周次：第 ${g.weeks[0]}～${g.weeks[g.weeks.length - 1]} 周（共 ${g.weeks.length} 周）`,
    `教室布局：${s.rows} 排 × ${s.cols} 列，${MODE_TEXT[s.mode]}`,
    `前排口径：前 ${s.frontRows} 排（视力需前排的硬约束与「前排次数」都按此 N 计算）`,
    `前/中/后排划分：每段 ceil(${s.rows}/3) = ${Math.max(1, Math.ceil(s.rows / 3))} 排`,
    `规则开关：身高序（高个靠后）${s.heightRule ? '开启' : '关闭'}；同桌分层搭配${s.mixTiers ? '开启' : '关闭'}`,
    `计划周数：${s.weeks} 周；随机种子：${s.seed}（同配置 + 同种子可复现完全相同的座位表）`,
  ]
}

// CSV 头部注释：口径 + 每个指标的定义与算法
export function csvHeaderComments(lines: { caliber: string[]; metrics: MetricDef[]; avgHint?: string }): string[] {
  const out: string[] = []
  out.push('# 本报告各项数字的统计口径与算法说明（# 开头为注释行，不影响表格读取）')
  for (const l of lines.caliber) out.push(`# ${l}`)
  out.push('# —— 指标定义 ——')
  for (const m of lines.metrics) {
    out.push(`# · ${m.label}：${m.def}${m.good ? `（判读：${m.good}）` : ''}`)
  }
  if (lines.avgHint) out.push(`# · 平均位置分：${COL_AVG_DEF}（${lines.avgHint}）`)
  return out
}

// CSV 尾部的列说明（保留原有「位置分说明」并补齐各列）
export function csvColumnNotes(frontRows: number, cols: number): string[] {
  return [
    `# 列说明：前${frontRows}排次数＝${colFrontRowsDef(frontRows)}`,
    `# 列说明：前/中/后排次数＝${COL_THIRDS_DEF}`,
    `# 列说明：中间列次数＝${colMiddleColDef(cols)}`,
    `# 列说明：平均位置分＝${COL_AVG_DEF}`,
    `# 列说明：同桌次数＝${COL_DESKCOUNT_DEF}`,
    '# 判读：平均位置分越低位置越好；前排次数极差越小、同桌超限对越少越公平。',
  ]
}
