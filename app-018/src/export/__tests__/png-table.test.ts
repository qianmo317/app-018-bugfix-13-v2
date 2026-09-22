// 布光参数表（导出 PNG 与打印视图共用 tableRows）取值与排版口径测试
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { tableRows, drawPlanToCanvas } from '../png';
import { newLamp, newScene } from '../../core/factory';
import { relativeAngleToSubject, angleFromCameraAxis } from '../../core/geometry';
import { lampCoverage } from '../../core/coverage';
import type { Scene } from '../../types';

// 列顺序：['#', '灯位', '类型', '功率', 'GN', '距模特(m)', '相对角度', '相机轴角', '灯高(m)', '配件', '光斑(m)', '色片']
const COL = {
  idx: 0,
  role: 1,
  kind: 2,
  power: 3,
  gn: 4,
  dist: 5,
  relAngle: 6,
  camAxis: 7,
  height: 8,
  modifier: 9,
  spot: 10,
  gel: 11,
} as const;

/** 两盏灯的场景：主光闪光灯在模特左侧（轴角 -45°），辅光持续灯在右侧 */
function twoLampScene(): Scene {
  const s = newScene(); // 模特 (3, 3.1) facing -90，相机 (3, 1)
  const key = newLamp(1, 2.1, { role: 'key', kind: 'strobe', gnAtFull: 60, powerStep: '1/2' });
  key.modifier = { type: 'softbox', w: 0.6, h: 0.9 };
  key.heightMm = 1200;
  const fill = newLamp(4.5, 2.5, { role: 'fill', kind: 'continuous' });
  fill.lumens = 10000;
  fill.watts = undefined;
  s.lamps = [key, fill];
  return s;
}

describe('tableRows 参数口径（与编辑器显示一致）', () => {
  it('序号从 1 开始递增', () => {
    const rows = tableRows(twoLampScene());
    expect(rows[0].cells[COL.idx]).toBe(1);
    expect(rows[1].cells[COL.idx]).toBe(2);
  });

  it('类型列：闪光灯 / 持续灯（与编辑器选项同名，不是「常亮灯」）', () => {
    const rows = tableRows(twoLampScene());
    expect(rows[0].cells[COL.kind]).toBe('闪光灯');
    expect(rows[1].cells[COL.kind]).toBe('持续灯');
  });

  it('功率列：闪光灯给档位；持续灯给 lm，只填 W 时给 W，都没有给短横', () => {
    const s = twoLampScene();
    let rows = tableRows(s);
    expect(rows[0].cells[COL.power]).toBe('1/2');
    expect(rows[1].cells[COL.power]).toBe('10000lm');

    s.lamps[1].lumens = undefined;
    s.lamps[1].watts = 150;
    rows = tableRows(s);
    expect(rows[1].cells[COL.power]).toBe('150W');

    s.lamps[1].watts = undefined;
    rows = tableRows(s);
    expect(rows[1].cells[COL.power]).toBe('—');
  });

  it('GN 列：闪光灯给 GN，持续灯给短横', () => {
    const rows = tableRows(twoLampScene());
    expect(rows[0].cells[COL.gn]).toBe(60);
    expect(rows[1].cells[COL.gn]).toBe('—');
  });

  it('距离列单位是米（平面坐标直接取值，不乘 100）', () => {
    const s = twoLampScene();
    const rows = tableRows(s);
    const d0 = Math.hypot(s.subject.x - s.lamps[0].x, s.subject.y - s.lamps[0].y);
    expect(rows[0].cells[COL.dist]).toBe(d0.toFixed(2));
    expect(Number(rows[0].cells[COL.dist])).toBeCloseTo(Math.hypot(2, 1), 2); // ≈2.24m，不应是 223.61
    expect(Number(rows[0].cells[COL.dist])).toBeLessThan(10);
  });

  it('相对角度列与相机轴角列没有对调，且随模特朝向更新的是相对角度', () => {
    const s = twoLampScene();
    let rows = tableRows(s);
    expect(rows[0].cells[COL.relAngle]).toBe(`${relativeAngleToSubject(s, s.lamps[0]).toFixed(0)}°`);
    expect(rows[0].cells[COL.camAxis]).toBe(`${angleFromCameraAxis(s, s.lamps[0]).toFixed(0)}°`);

    // 模特转向后相对角度变化、相机轴角不变（与编辑器 coverage-info 同一口径）
    s.subject.facing = 0;
    rows = tableRows(s);
    expect(rows[0].cells[COL.relAngle]).toBe(`${relativeAngleToSubject(s, s.lamps[0]).toFixed(0)}°`);
    expect(rows[0].cells[COL.camAxis]).toBe(`${angleFromCameraAxis(s, s.lamps[0]).toFixed(0)}°`);
    expect(relativeAngleToSubject(s, s.lamps[0])).not.toBeCloseTo(angleFromCameraAxis(s, s.lamps[0]), 1);
  });

  it('灯高列单位是米（heightMm / 1000，不是毫米数直接当米）', () => {
    const rows = tableRows(twoLampScene());
    expect(rows[0].cells[COL.height]).toBe('1.20'); // 1200mm → 1.20m，不应是 1200.00
  });

  it('配件列宽在前、高在后（与编辑器 w×h 一致，不反）', () => {
    const rows = tableRows(twoLampScene());
    expect(rows[0].cells[COL.modifier]).toBe('柔光箱 0.60×0.90');
  });

  it('光斑列宽和高取各自的值（宽 ≠ 高时不能写成同一个数）', () => {
    const s = twoLampScene();
    const rows = tableRows(s);
    const cov = lampCoverage(s.lamps[0], Math.hypot(s.subject.x - s.lamps[0].x, s.subject.y - s.lamps[0].y));
    expect(cov.spot.w).not.toBeCloseTo(cov.spot.h, 6); // 前置条件：宽高确实不同
    expect(rows[0].cells[COL.spot]).toBe(`${cov.spot.w.toFixed(2)}×${cov.spot.h.toFixed(2)}`);
    const [w, h] = String(rows[0].cells[COL.spot]).split('×');
    expect(w).not.toBe(h);
  });

  it('色片未填时显示短横（与其他空值列一致），填了显示内容，纯空白也按未填处理', () => {
    const s = twoLampScene();
    expect(tableRows(s)[0].cells[COL.gel]).toBe('—');
    s.lamps[0].gel = 'CTO';
    expect(tableRows(s)[0].cells[COL.gel]).toBe('CTO');
    s.lamps[0].gel = '   ';
    expect(tableRows(s)[0].cells[COL.gel]).toBe('—');
  });

  it('行数与灯数一致，逐行角色正确', () => {
    const s = twoLampScene();
    const rows = tableRows(s);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.role)).toEqual(['key', 'fill']);
  });

  it('每行都有完整 12 列', () => {
    for (const row of tableRows(twoLampScene())) {
      expect(row.cells).toHaveLength(12);
      expect(row.cells.every((c) => String(c) !== '')).toBe(true);
    }
  });

  it('没有灯时给出占位行，所有格子为短横/占位文案', () => {
    const rows = tableRows(newScene());
    expect(rows).toHaveLength(1);
    expect(rows[0].cells[COL.idx]).toBe('—');
    expect(rows[0].cells[COL.role]).toBe('无灯具');
  });
});

describe('drawPlanToCanvas 参数表排版（行数再多也整张画在画布内）', () => {
  // 桩 canvas / 2d context：记录绘制指令与画布尺寸，node 环境下不依赖真实浏览器
  interface Cmd { type: string; x?: number; y?: number; w?: number; h?: number; text?: string }
  let savedDoc: typeof globalThis.document | undefined;

  class FakeCtx {
    cmds: Cmd[] = [];
    fillStyle = '';
    strokeStyle = '';
    lineWidth = 1;
    font = '';
    textAlign: CanvasTextAlign = 'left';
    // 简易变换栈：只处理 translate + 均匀 scale（drawPlanToCanvas 的表格段用法）
    private stack: { tx: number; ty: number; s: number }[] = [];
    private t = { tx: 0, ty: 0, s: 1 };
    setLineDash() {}
    save() { this.stack.push({ ...this.t }); }
    restore() { this.t = this.stack.pop() ?? { tx: 0, ty: 0, s: 1 }; }
    translate(x: number, y: number) { this.t.tx += x * this.t.s; this.t.ty += y * this.t.s; }
    scale(s: number) { this.t.s *= s; }
    private X(x: number) { return this.t.tx + x * this.t.s; }
    private Y(y: number) { return this.t.ty + y * this.t.s; }
    private K(v: number) { return v * this.t.s; }
    beginPath() {}
    moveTo() {}
    lineTo() {}
    closePath() {}
    arc() {}
    ellipse() {}
    rect() {}
    fillRect(x: number, y: number, w: number, h: number) {
      this.cmds.push({ type: 'fillRect', x: this.X(x), y: this.Y(y), w: this.K(w), h: this.K(h) });
    }
    strokeRect(x: number, y: number, w: number, h: number) {
      this.cmds.push({ type: 'strokeRect', x: this.X(x), y: this.Y(y), w: this.K(w), h: this.K(h) });
    }
    fillText(text: string, x: number, y: number) {
      this.cmds.push({ type: 'fillText', text, x: this.X(x), y: this.Y(y) });
    }
    fill() {}
    stroke() {}
    rotate() {}
  }

  let lastCtx: FakeCtx;
  let lastCanvas: { width: number; height: number };

  beforeAll(() => {
    savedDoc = globalThis.document;
    lastCtx = new FakeCtx();
    lastCanvas = { width: 0, height: 0 };
    globalThis.document = {
      createElement: (tag: string) => {
        if (tag !== 'canvas') throw new Error(`unexpected element ${tag}`);
        return {
          set width(v: number) { lastCanvas.width = v; },
          get width() { return lastCanvas.width; },
          set height(v: number) { lastCanvas.height = v; },
          get height() { return lastCanvas.height; },
          getContext: () => { lastCtx = new FakeCtx(); return lastCtx; },
          toBlob: (cb: BlobCallback) => cb(new Blob(['x'])),
        };
      },
    } as unknown as Document;
  });

  afterAll(() => {
    globalThis.document = savedDoc as Document;
  });

  function sceneWithNLamps(n: number): Scene {
    const s = newScene();
    s.lamps = Array.from({ length: n }, (_, i) => {
      const lamp = newLamp(0.5 + (i % 10) * 0.55, 0.5 + Math.floor(i / 10) * 0.5, { role: 'fill' });
      lamp.modifier = { type: 'softbox', w: 0.6, h: 0.9 };
      return lamp;
    });
    return s;
  }

  it('20 盏灯：画布高度随行数增长，表格外框与末行文字都在画布内', () => {
    drawPlanToCanvas(sceneWithNLamps(20));
    const { height: H } = lastCanvas;
    const rows = tableRows(sceneWithNLamps(20));
    expect(rows).toHaveLength(20);

    // 所有矩形/文字的底边都不得超出画布
    for (const c of lastCtx.cmds) {
      if (c.type === 'fillRect' || c.type === 'strokeRect') {
        expect(c.y! + c.h!, `矩形 ${c.type}@y=${c.y}`).toBeLessThanOrEqual(H);
      }
      if (c.type === 'fillText') {
        expect(c.y!, `文字「${c.text}」@y=${c.y}`).toBeLessThanOrEqual(H - 1);
      }
    }

    // 末行序号 20 必须被画出，且其基线位置在画布内
    const lastRowNumber = lastCtx.cmds.find((c) => c.type === 'fillText' && c.text === '20');
    expect(lastRowNumber, '末行序号 20 应存在').toBeTruthy();
    expect(lastRowNumber!.y!).toBeLessThan(H);

    // 表格整表外框（最后绘制的 strokeRect）底边距画布底应留有正的空白
    const outerBoxes = lastCtx.cmds.filter((c) => c.type === 'strokeRect');
    const tableBox = outerBoxes[outerBoxes.length - 1];
    expect(tableBox.y! + tableBox.h!).toBeLessThanOrEqual(H - 10);
  });

  it('画布高度随行数线性增长（1 灯与 20 灯对比），不再是固定一行高度', () => {
    drawPlanToCanvas(sceneWithNLamps(1));
    const h1 = lastCanvas.height;
    drawPlanToCanvas(sceneWithNLamps(20));
    const h20 = lastCanvas.height;
    expect(h20 - h1).toBeGreaterThan(100); // 多出 19 行必须把画布撑高数百像素
  });
});
