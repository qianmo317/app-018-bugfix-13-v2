// 参数表取值与编辑器对齐的回归测试（PNG 导出与打印视图共用 tableRows）
import { describe, it, expect } from 'vitest';
import { tableRows } from '../png';
import { newLamp, newScene } from '../../core/factory';
import { relativeAngleToSubject, angleFromCameraAxis } from '../../core/geometry';
import { lampCoverage } from '../../core/coverage';

// 列序：0 '#' 1 灯位 2 类型 3 功率 4 GN 5 距模特(m) 6 相对角度 7 相机轴角 8 灯高(m) 9 配件 10 光斑(m) 11 色片

describe('参数表 tableRows', () => {
  it('序号从 1 开始逐行递增', () => {
    const s = newScene();
    s.lamps = [newLamp(1, 3.1), newLamp(5, 3.1), newLamp(3, 1.5)];
    const rows = tableRows(s);
    expect(rows.map((r) => r.cells[0])).toEqual([1, 2, 3]);
  });

  it('类型列用词与编辑器一致：闪光灯 / 持续灯', () => {
    const s = newScene();
    s.lamps = [newLamp(1, 3.1), newLamp(5, 3.1, { kind: 'continuous' })];
    const rows = tableRows(s);
    expect(rows[0].cells[2]).toBe('闪光灯');
    expect(rows[1].cells[2]).toBe('持续灯');
  });

  it('持续灯功率列单位与编辑器一致：lm 或 W', () => {
    const s = newScene();
    const a = newLamp(1, 3.1, { kind: 'continuous' });
    a.lumens = 10000;
    const b = newLamp(5, 3.1, { kind: 'continuous' });
    b.watts = 200;
    s.lamps = [a, b];
    const rows = tableRows(s);
    expect(rows[0].cells[3]).toBe('10000lm');
    expect(rows[1].cells[3]).toBe('200W');
  });

  it('距模特列为平面距离（米），不放大', () => {
    const s = newScene(); // 模特 (3, 3.1)
    s.lamps = [newLamp(1, 3.1)]; // 距离 2m
    const rows = tableRows(s);
    expect(rows[0].cells[5]).toBe('2.00');
  });

  it('相对角度与相机轴角两列不颠倒', () => {
    const s = newScene();
    s.camera = { ...s.camera, x: 1, y: 1 }; // 相机偏离模特朝向轴，两角度才会不同
    s.lamps = [newLamp(5, 3.1)];
    const rel = relativeAngleToSubject(s, s.lamps[0]);
    const axis = angleFromCameraAxis(s, s.lamps[0]);
    expect(rel.toFixed(0)).not.toBe(axis.toFixed(0)); // 场景前提：两值确实不同
    const rows = tableRows(s);
    expect(rows[0].cells[6]).toBe(`${rel.toFixed(0)}°`);
    expect(rows[0].cells[7]).toBe(`${axis.toFixed(0)}°`);
  });

  it('灯高列由毫米换算为米', () => {
    const s = newScene();
    s.lamps = [newLamp(1, 3.1, { heightMm: 1200 }), newLamp(5, 3.1, { heightMm: 2650 })];
    const rows = tableRows(s);
    expect(rows[0].cells[8]).toBe('1.20');
    expect(rows[1].cells[8]).toBe('2.65');
  });

  it('配件列为「名称 宽×高」，宽高顺序与编辑器一致', () => {
    const s = newScene();
    s.lamps = [newLamp(1, 3.1)]; // 默认柔光箱 0.6×0.9
    const rows = tableRows(s);
    expect(rows[0].cells[9]).toBe('柔光箱 0.60×0.90');
  });

  it('光斑列为 宽×高，宽与高分别计算', () => {
    const s = newScene();
    const lamp = newLamp(1, 3.1); // 柔光箱 0.6×0.9 → 光斑宽≠高
    s.lamps = [lamp];
    const cov = lampCoverage(lamp, 2);
    expect(cov.spot.w).not.toBe(cov.spot.h);
    const rows = tableRows(s);
    expect(rows[0].cells[10]).toBe(`${cov.spot.w.toFixed(2)}×${cov.spot.h.toFixed(2)}`);
  });

  it('色片未填显示短横，填写后原样展示', () => {
    const s = newScene();
    const bare = newLamp(1, 3.1);
    const gelled = newLamp(5, 3.1);
    gelled.gel = 'CTO';
    s.lamps = [bare, gelled];
    const rows = tableRows(s);
    expect(rows[0].cells[11]).toBe('—');
    expect(rows[1].cells[11]).toBe('CTO');
  });

  it('无灯具时给出占位行', () => {
    const rows = tableRows(newScene());
    expect(rows).toHaveLength(1);
    expect(rows[0].cells[1]).toBe('无灯具');
  });
});
