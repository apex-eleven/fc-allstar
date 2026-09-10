/**
 * เทสค่าตีบวกที่ติดมากับการ์ดในซอง
 *
 * จุดที่ต้องล็อกไว้ให้แน่น:
 *   1. ซองเก่าที่ไม่ได้ตั้งอะไร ต้องออก +0 เหมือนเดิมเป๊ะ — ของเดิมห้ามพัง
 *   2. ค่าที่สุ่มได้ต้องแปลงเป็น level ที่เก็บจริงถูกต้อง ไม่ใช่หายไปเงียบ ๆ
 */
import { describe, expect, it } from 'vitest';
import { MAX_UPGRADE } from '@/data/upgradeConfig';
import { getCardUpgrade } from '@/services/cardInstance';
import {
  getPackUpgradeChances,
  getPackUpgradeRange,
  normalizePackUpgradeOdds,
  openPack,
  PACK_UPGRADE_COLUMNS,
  PACK_UPGRADE_PRESETS,
  packRollsUpgrade,
  rollPackUpgrade,
} from '@/services/cardPack';
import type { CardPack } from '@/types/card';

const packOf = (upgradeOdds?: number[]): CardPack => ({
  id: 'test-pack',
  name: 'ซองทดสอบ',
  tier: 'gold',
  price: 1000,
  cardCount: 3,
  odds: { common: 60, rare: 25, epic: 10, legendary: 4, mythical: 1 },
  description: '',
  ...(upgradeOdds ? { upgradeOdds } : {}),
});

describe('ซองที่ไม่ได้ตั้งค่าตีบวก', () => {
  it('ออก +0 ทุกใบ', () => {
    const pack = packOf();
    expect(packRollsUpgrade(pack)).toBe(false);
    expect(getPackUpgradeRange(pack)).toBeNull();

    openPack(pack, 5).cards.forEach((card) => expect(getCardUpgrade(card)).toBe(0));
  });

  it('ตั้งไว้แต่ให้น้ำหนัก +0 อย่างเดียว ก็ยังถือว่าไม่สุ่ม', () => {
    const pack = packOf([...PACK_UPGRADE_PRESETS.none.odds]);
    expect(packRollsUpgrade(pack)).toBe(false);
    expect(rollPackUpgrade(pack)).toBe(0);
  });
});

describe('บีบตารางค่าตีบวก', () => {
  it('เติมช่องที่ขาดให้ครบ 9 ช่อง', () => {
    expect(normalizePackUpgradeOdds([0, 10])).toHaveLength(PACK_UPGRADE_COLUMNS);
  });

  it('ค่าติดลบและค่าที่ไม่ใช่ตัวเลขกลายเป็น 0', () => {
    const row = normalizePackUpgradeOdds([-5, 'พัง', 10, null, 0, 0, 0, 0, 0]);
    expect(row?.[0]).toBe(0);
    expect(row?.[1]).toBe(0);
    expect(row?.[2]).toBe(10);
  });

  it('ไม่ใช่อาร์เรย์ หรือเป็นศูนย์ทั้งแถว = ไม่ได้ตั้ง', () => {
    expect(normalizePackUpgradeOdds(undefined)).toBeUndefined();
    expect(normalizePackUpgradeOdds('พัง')).toBeUndefined();
    expect(normalizePackUpgradeOdds([0, 0, 0, 0, 0, 0, 0, 0, 0])).toBeUndefined();
  });
});

describe('การสุ่มค่าตีบวก', () => {
  it('ล็อกให้ออก +8 ทางเดียว สุ่มกี่ครั้งก็ได้ +8', () => {
    const pack = packOf([0, 0, 0, 0, 0, 0, 0, 0, 1]);
    for (let round = 0; round < 50; round += 1) {
      expect(rollPackUpgrade(pack)).toBe(MAX_UPGRADE);
    }
  });

  it('ค่าที่ออกอยู่ในช่วงที่ตั้งไว้เสมอ', () => {
    const pack = packOf([...PACK_UPGRADE_PRESETS.jackpot.odds]);
    const range = getPackUpgradeRange(pack);
    expect(range).toEqual({ min: 5, max: 8 });

    for (let round = 0; round < 200; round += 1) {
      const plus = rollPackUpgrade(pack);
      expect(plus).toBeGreaterThanOrEqual(5);
      expect(plus).toBeLessThanOrEqual(MAX_UPGRADE);
    }
  });

  it('คิดเป็นสัดส่วนเสมอ ไม่ต้องรวมให้ครบ 100', () => {
    const chances = getPackUpgradeChances(packOf([0, 3, 1, 0, 0, 0, 0, 0, 0]));
    expect(chances[1].chance).toBeCloseTo(75, 6);
    expect(chances[2].chance).toBeCloseTo(25, 6);
    expect(chances.reduce((sum, entry) => sum + entry.chance, 0)).toBeCloseTo(100, 6);
  });

  it('ชุดสำเร็จรูป "มาตรฐาน" ออกได้ +1 ถึง +8 ครบทุกค่า', () => {
    const pack = packOf([...PACK_UPGRADE_PRESETS.standard.odds]);
    expect(getPackUpgradeRange(pack)).toEqual({ min: 1, max: MAX_UPGRADE });
    // ไม่มีทางออก +0 เพราะช่องแรกน้ำหนักเป็นศูนย์
    expect(getPackUpgradeChances(pack)[0].chance).toBe(0);
  });
});

describe('เปิดซองจริง', () => {
  it('การ์ดที่ได้มีค่าตีบวกติดมาด้วย และแปลงเป็น level ถูกต้อง', () => {
    const pack = packOf([0, 0, 0, 0, 0, 1, 0, 0, 0]);
    const { cards } = openPack(pack, 4);

    expect(cards).toHaveLength(pack.cardCount * 4);
    cards.forEach((card) => {
      expect(getCardUpgrade(card)).toBe(5);
      // level ที่เก็บจริงต้องไม่ใช่ 1 แล้ว ไม่งั้นแปลว่าค่าบวกหายระหว่างทาง
      expect(card.level).toBeGreaterThan(1);
    });
  });

  it('แต่ละใบในซองเดียวกันสุ่มแยกกัน ไม่ใช่ค่าเดียวกันทั้งซอง', () => {
    const pack = { ...packOf([...PACK_UPGRADE_PRESETS.premium.odds]), cardCount: 10 };
    const seen = new Set(openPack(pack, 12).cards.map((card) => getCardUpgrade(card)));

    // 120 ใบจากตารางที่กระจาย +1 ถึง +8 แทบเป็นไปไม่ได้ที่จะออกค่าเดียวล้วน
    expect(seen.size).toBeGreaterThan(1);
  });
});
