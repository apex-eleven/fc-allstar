/**
 * เทสกติกาการผสมการ์ด — ยึดข้อกำหนดของเกมเป็นหลัก
 * ข้อไหนเป็นตัวเลขที่ตกลงกันไว้ (เช่น +8 ครบทุกใบ = 20%) ต้องมีเทสล็อกไว้เสมอ
 * และต้องเทสด้วยว่าค่าที่แอดมินตั้งมีผลจริง ไม่ใช่โดนค่าคงที่ในโค้ดทับ
 */
import { describe, expect, it } from 'vitest';
import { MAX_UPGRADE } from '@/data/upgradeConfig';
import { levelForUpgrade } from '@/services/cardInstance';
import {
  canWinCash,
  DEFAULT_FUSION,
  DEFAULT_FUSION_ODDS,
  FUSION_LIMITS,
  FUSION_ODDS_COLUMNS,
  getFusionOdds,
  getFusionPool,
  getMaterialPlus,
  getMaterialRarity,
  normalizeFusion,
  rollFusionCandidates,
  rollFusionCash,
  rollFusionPlus,
} from '@/services/fusion';
import { PLAYERS } from '@/data/players';
import type { CardInstance } from '@/types/card';

const config = DEFAULT_FUSION;

const card = (playerId: string, plus = 0): CardInstance => ({
  id: `card_${playerId}_${plus}`,
  playerId,
  acquiredAt: '2026-01-01T00:00:00.000Z',
  level: levelForUpgrade(plus),
  inSquad: false,
});

const byRarity = (index: number) =>
  PLAYERS.filter((player) => player.rarity === PLAYERS[index].rarity);

describe('ตารางโอกาสเริ่มต้น', () => {
  it('ทุกแถวรวมกันได้ 100 พอดี', () => {
    Object.values(DEFAULT_FUSION_ODDS).forEach((row) => {
      const total = row.reduce((sum, chance) => sum + chance, 0);
      expect(Number(total.toFixed(4))).toBe(100);
    });
  });

  it('ทุกแถวมีผลลัพธ์ครบ +1 ถึง +8', () => {
    Object.values(DEFAULT_FUSION_ODDS).forEach((row) =>
      expect(row).toHaveLength(FUSION_ODDS_COLUMNS),
    );
    expect(getFusionOdds(0, config).map((entry) => entry.plus)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('ใช้ +8 ครบทุกใบ โอกาสออก +8 เท่ากับ 20%', () => {
    const odds = getFusionOdds(MAX_UPGRADE, config);
    expect(odds.find((entry) => entry.plus === MAX_UPGRADE)?.chance).toBeCloseTo(20, 6);
  });

  it('วัสดุยิ่งบวกสูง โอกาสออก +8 ยิ่งไม่ลดลง', () => {
    const chances = Array.from(
      { length: MAX_UPGRADE + 1 },
      (_, plus) => getFusionOdds(plus, config).find((entry) => entry.plus === MAX_UPGRADE)!.chance,
    );
    chances.slice(1).forEach((chance, index) => expect(chance).toBeGreaterThan(chances[index]));
  });

  it('คิดเป็นสัดส่วนเสมอ แอดมินไม่ต้องบวกให้ครบ 100', () => {
    const doubled = normalizeFusion({
      ...config,
      odds: { ...config.odds, '8': config.odds['8'].map((weight) => weight * 7) },
    });
    expect(
      getFusionOdds(MAX_UPGRADE, doubled).find((entry) => entry.plus === MAX_UPGRADE)?.chance,
    ).toBeCloseTo(20, 6);
  });
});

describe('ค่าตั้งจากแอดมิน', () => {
  it('บีบจำนวนวัสดุ/การ์ดคว่ำให้อยู่ในกรอบ', () => {
    const tooMany = normalizeFusion({ materials: 99, candidates: 99 });
    expect(tooMany.materials).toBe(FUSION_LIMITS.materials.max);
    expect(tooMany.candidates).toBe(FUSION_LIMITS.candidates.max);
  });

  it('แถวที่เป็นศูนย์ทั้งแถวถอยไปใช้แถวเริ่มต้น (กันสุ่มไม่ออก)', () => {
    const broken = normalizeFusion({ odds: { '0': [0, 0, 0, 0, 0, 0, 0, 0] } });
    expect(broken.odds['0']).toEqual(DEFAULT_FUSION_ODDS['0']);
  });

  it('กรอกช่วงเงินกลับด้าน ระบบสลับให้เอง', () => {
    const swapped = normalizeFusion({ cashMin: 5_000_000, cashMax: 1_000_000 });
    expect(swapped.cashMin).toBe(1_000_000);
    expect(swapped.cashMax).toBe(5_000_000);
  });

  it('น้ำหนักที่แอดมินตั้งมีผลกับการสุ่มจริง', () => {
    // ล็อกให้ออก +8 ทางเดียว แล้วสุ่มกี่ครั้งก็ต้องได้ +8
    const forced = normalizeFusion({ odds: { '0': [0, 0, 0, 0, 0, 0, 0, 1] } });
    for (let index = 0; index < 50; index += 1) {
      expect(rollFusionPlus(0, forced)).toBe(MAX_UPGRADE);
    }
  });

  it('จำนวนการ์ดคว่ำตามที่แอดมินตั้ง', () => {
    const three = normalizeFusion({ candidates: 3 });
    expect(rollFusionCandidates(PLAYERS[0].rarity, 0, three)).toHaveLength(3);
  });
});

describe('ค่าบวกของชุดวัสดุ', () => {
  it('ใช้ใบที่บวกน้อยที่สุด ไม่ใช่ค่าเฉลี่ย', () => {
    expect(getMaterialPlus([card('p001', 8), card('p002', 8), card('p003', 2)])).toBe(2);
  });

  it('ชุดว่างคืน 0', () => {
    expect(getMaterialPlus([])).toBe(0);
  });
});

describe('กติกาเรื่องระดับการ์ด', () => {
  it('ระดับเดียวกันทั้งชุด → คืนระดับนั้น', () => {
    const same = byRarity(0).slice(0, 3);
    expect(same.length).toBe(3);
    expect(getMaterialRarity(same.map((player) => card(player.id)))).toBe(same[0].rarity);
  });

  it('ระดับปนกัน → คืน null (ผสมไม่ได้)', () => {
    const first = PLAYERS[0];
    const other = PLAYERS.find((player) => player.rarity !== first.rarity);
    expect(other).toBeDefined();
    expect(getMaterialRarity([card(first.id), card(first.id), card(other!.id)])).toBeNull();
  });
});

describe('เงินโบนัส', () => {
  it('ต่ำกว่าเกณฑ์ไม่มีสิทธิ์ลุ้นเลย', () => {
    expect(canWinCash(config.cashMinPlus - 1, config)).toBe(false);
    expect(rollFusionCash(config.cashMinPlus - 1, config, () => 0)).toBe(0);
  });

  it('ถึงเกณฑ์และดวงถึง ได้เงินในช่วงที่ตั้งไว้', () => {
    const amount = rollFusionCash(config.cashMinPlus, config, () => 0);
    expect(amount).toBeGreaterThanOrEqual(config.cashMin);
    expect(amount).toBeLessThanOrEqual(config.cashMax);
  });

  it('ดวงไม่ถึงก็ยังได้ 0 แม้วัสดุจะครบเงื่อนไข', () => {
    expect(rollFusionCash(MAX_UPGRADE, config, () => 0.99)).toBe(0);
  });

  it('ปิดสวิตช์แล้วไม่ออกเงินไม่ว่ากรณีไหน', () => {
    const off = normalizeFusion({ ...config, cashEnabled: false });
    expect(canWinCash(MAX_UPGRADE, off)).toBe(false);
    expect(rollFusionCash(MAX_UPGRADE, off, () => 0)).toBe(0);
  });
});

describe('การสุ่มผลลัพธ์', () => {
  it('ค่าบวกที่ออกอยู่ในช่วง +1 ถึง +8 เสมอ', () => {
    for (let index = 0; index < 200; index += 1) {
      const plus = rollFusionPlus(index % (MAX_UPGRADE + 1), config);
      expect(plus).toBeGreaterThanOrEqual(1);
      expect(plus).toBeLessThanOrEqual(MAX_UPGRADE);
    }
  });

  it('การ์ดคว่ำครบจำนวน และทุกใบเป็นนักเตะระดับเดิม', () => {
    const rarity = PLAYERS[0].rarity;
    const candidates = rollFusionCandidates(rarity, MAX_UPGRADE, config);
    const pool = new Set(getFusionPool(rarity).map((player) => player.id));

    expect(candidates).toHaveLength(config.candidates);
    candidates.forEach((candidate) => expect(pool.has(candidate.playerId)).toBe(true));
  });
});
