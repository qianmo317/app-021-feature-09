import type { ClassEntity, GenSnapshot, LayoutConfig } from '../types'

// ================= 生成口径快照 =================
// 每份周次表在生成时固化当时的配置；报告按各周快照计算，
// 配置事后被改动也能用「早先那套算法」还原旧报告。

export function captureSnapshot(cls: ClassEntity, seed: number, weeks?: number, createdAt?: number): GenSnapshot {
  return {
    schema: 1,
    rows: cls.layout.rows,
    cols: cls.layout.cols,
    aisles: [...cls.layout.aisles],
    mode: cls.layout.mode,
    frontRows: cls.constraints.frontRows,
    heightRule: cls.constraints.heightRule,
    mixTiers: cls.constraints.mixTiers,
    weeks: weeks ?? cls.weeks,
    seed,
    createdAt: createdAt ?? 0,
  }
}

// 旧数据（快照字段缺失）的兼容分组键
export const LEGACY_KEY = 'legacy'

// 决定某周用哪套「统计口径」：优先该周自己的快照，否则退回班级当前配置
export function snapshotKey(asg: { gen?: GenSnapshot }): string {
  const g = asg.gen
  if (!g) return LEGACY_KEY
  return [g.rows, g.cols, g.aisles.join('-'), g.mode, g.frontRows, g.heightRule ? 1 : 0, g.mixTiers ? 1 : 0, g.seed, g.weeks].join('|')
}

// 当前班级配置对应的快照（用于和报告口径对比，判断是否已偏离生成时配置）
export function currentSnapshot(cls: ClassEntity): GenSnapshot {
  return captureSnapshot(cls, cls.seed, cls.weeks, 0)
}

// 除「计划周数」外是否一致：周数不同通常只是补齐/截短，不算算法变了
export function isSameCaliber(a: GenSnapshot, b: GenSnapshot): boolean {
  return (
    a.rows === b.rows &&
    a.cols === b.cols &&
    a.mode === b.mode &&
    a.frontRows === b.frontRows &&
    a.heightRule === b.heightRule &&
    a.mixTiers === b.mixTiers &&
    a.seed === b.seed &&
    a.aisles.length === b.aisles.length &&
    a.aisles.every((v, i) => v === b.aisles[i])
  )
}

export interface CaliberDiff {
  field: string
  label: string
  oldV: string
  newV: string
}

const MODE_TEXT: Record<LayoutConfig['mode'], string> = { rows: '行列排座', groups: '小组围坐' }

export function diffCaliber(oldSnap: GenSnapshot, cur: GenSnapshot): CaliberDiff[] {
  const out: CaliberDiff[] = []
  if (oldSnap.rows !== cur.rows) out.push({ field: 'rows', label: '行数', oldV: `${oldSnap.rows} 排`, newV: `${cur.rows} 排` })
  if (oldSnap.cols !== cur.cols) out.push({ field: 'cols', label: '列数', oldV: `${oldSnap.cols} 列`, newV: `${cur.cols} 列` })
  if (oldSnap.frontRows !== cur.frontRows)
    out.push({ field: 'frontRows', label: '前排数', oldV: `前 ${oldSnap.frontRows} 排`, newV: `前 ${cur.frontRows} 排` })
  if (oldSnap.seed !== cur.seed) out.push({ field: 'seed', label: '种子', oldV: String(oldSnap.seed), newV: String(cur.seed) })
  if (oldSnap.heightRule !== cur.heightRule)
    out.push({ field: 'heightRule', label: '身高序规则', oldV: oldSnap.heightRule ? '开' : '关', newV: cur.heightRule ? '开' : '关' })
  if (oldSnap.mixTiers !== cur.mixTiers)
    out.push({ field: 'mixTiers', label: '分层搭配', oldV: oldSnap.mixTiers ? '开' : '关', newV: cur.mixTiers ? '开' : '关' })
  if (oldSnap.mode !== cur.mode)
    out.push({ field: 'mode', label: '排座模式', oldV: MODE_TEXT[oldSnap.mode], newV: MODE_TEXT[cur.mode] })
  return out
}
