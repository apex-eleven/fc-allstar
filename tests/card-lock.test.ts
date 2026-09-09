/**
 * เทสระบบล็อกการ์ด — ข้อกำหนดมีสองด้านและต้องจริงทั้งคู่
 *   1. ล็อกแล้ว "หาไม่ได้" จากทุกช่องทาง
 *   2. ล็อกแล้ว "ไม่ยึด" ของที่ผู้เล่นมีอยู่แล้ว
 *
 * ทะเบียนเป็น state ระดับโมดูล จึงต้อง clearCardLock() ทุกครั้งหลังเทส
 * ไม่งั้นเทสไฟล์อื่นที่รันต่อจากนี้จะเจอการ์ดที่ยังล็อกค้างอยู่
 */
import { afterEach, describe, expect, it } from 'vitest';
import { PLAYERS } from '@/data/players';
import {
  CARD_LOCK_DEFAULT_NOTE,
  clearCardLock,
  filterUnlockedIds,
  filterUnlockedPlayers,
  getCardLockNote,
  getUnlockedPlayers,
  isPlayerLocked,
  lockedCount,
  normalizeCardLock,
  setCardLock,
} from '@/services/cardLock';
import { getPackPlayers } from '@/services/cardPack';
import { DEFAULT_FUSION, getFusionPool, rollFusionCandidates } from '@/services/fusion';
import { getRotationPlayers } from '@/services/exchangeRotation';
import { getMarketPool } from '@/services/market';
import { isItemLive } from '@/services/pointsExchange';
import type { CardPack, PointsExchangeItem } from '@/types/card';

/** นักเตะตัวอย่างของแต่ละระดับ ใช้เป็นเป้าล็อกในเทส */
const victim = PLAYERS[0];
const mythical = PLAYERS.find((player) => player.rarity === 'mythical') ?? PLAYERS[0];

const lock = (...ids: string[]) => setCardLock({ ids, note: '' });

afterEach(() => clearCardLock());

describe('ทะเบียนรายชื่อที่ล็อก', () => {
  it('ยังไม่ตั้งอะไร = ไม่ล็อกใครเลย', () => {
    expect(lockedCount()).toBe(0);
    expect(isPlayerLocked(victim.id)).toBe(false);
    expect(getUnlockedPlayers()).toHaveLength(PLAYERS.length);
  });

  it('ล็อกแล้วอ่านค่ากลับได้ตรง', () => {
    lock(victim.id);
    expect(isPlayerLocked(victim.id)).toBe(true);
    expect(lockedCount()).toBe(1);
    expect(getUnlockedPlayers()).toHaveLength(PLAYERS.length - 1);
  });

  it('ไม่ตั้งข้อความเอง ใช้ข้อความเริ่มต้น', () => {
    lock(victim.id);
    expect(getCardLockNote()).toBe(CARD_LOCK_DEFAULT_NOTE);

    setCardLock({ ids: [victim.id], note: 'รอเปิดซีซันหน้า' });
    expect(getCardLockNote()).toBe('รอเปิดซีซันหน้า');
  });

  it('ตัวช่วยกรองตัดเฉพาะใบที่ล็อก', () => {
    lock(victim.id);
    expect(filterUnlockedIds([victim.id, PLAYERS[1].id])).toEqual([PLAYERS[1].id]);
    expect(filterUnlockedPlayers(PLAYERS).some((player) => player.id === victim.id)).toBe(false);
  });
});

describe('บีบค่าจากเซิร์ฟเวอร์', () => {
  it('ตัด id ซ้ำและ id ที่ไม่มีอยู่จริง', () => {
    const clean = normalizeCardLock({
      ids: [victim.id, victim.id, 'ไม่มีคนนี้จริง', ''],
      note: 'ทดสอบ',
    });
    expect(clean.ids).toEqual([victim.id]);
    expect(clean.note).toBe('ทดสอบ');
  });

  it('ค่าว่าง/พังกลายเป็นไม่ล็อกใครเลย', () => {
    expect(normalizeCardLock(null).ids).toEqual([]);
    expect(normalizeCardLock({ ids: 'พัง' as unknown as string[] }).ids).toEqual([]);
  });
});

describe('หาไม่ได้จากทุกช่องทาง', () => {
  const packOf = (): CardPack => ({
    id: 'test-pack',
    name: 'ซองทดสอบ',
    price: 1000,
    cardCount: 1,
    odds: { common: 40, rare: 30, epic: 20, legendary: 9, mythical: 1 },
  });

  it('ซองการ์ด — หายทั้งจากพูลสุ่มและหน้าดูนักเตะในซอง', () => {
    const before = getPackPlayers(packOf());
    expect(before.some((player) => player.id === mythical.id)).toBe(true);

    lock(mythical.id);
    expect(getPackPlayers(packOf()).some((player) => player.id === mythical.id)).toBe(false);
  });

  it('ผสมการ์ด — ไม่อยู่ในพูลผลลัพธ์ และสุ่มกี่ครั้งก็ไม่ออก', () => {
    lock(mythical.id);
    expect(getFusionPool('mythical').some((player) => player.id === mythical.id)).toBe(false);

    for (let round = 0; round < 30; round += 1) {
      rollFusionCandidates('mythical', 8, DEFAULT_FUSION).forEach((candidate) =>
        expect(candidate.playerId).not.toBe(mythical.id),
      );
    }
  });

  it('ตลาดซื้อขาย — ไม่ขึ้นแผง', () => {
    expect(getMarketPool().some((player) => player.id === victim.id)).toBe(true);
    lock(victim.id);
    expect(getMarketPool().some((player) => player.id === victim.id)).toBe(false);
  });

  it('ร้านแลกตามรอบ — ไม่เข้าร้านในรอบไหนเลย', () => {
    lock(victim.id);
    for (let rotation = 0; rotation < 12; rotation += 1) {
      expect(getRotationPlayers(rotation).some((player) => player.id === victim.id)).toBe(false);
    }
  });

  it('ร้านแลกด้วยแต้ม — ใบที่ล็อกดับทันทีแม้แอดมินยังเปิดไว้', () => {
    const item: PointsExchangeItem = {
      id: 'item1',
      playerId: victim.id,
      price: 100,
      enabled: true,
    };

    expect(isItemLive(item)).toBe(true);
    lock(victim.id);
    expect(isItemLive(item)).toBe(false);
  });
});

describe('ไม่ยึดของที่มีอยู่แล้ว', () => {
  it('ล็อกแล้วนักเตะต้นแบบยังอยู่ในเกม ข้อมูลไม่หาย', () => {
    lock(victim.id);
    // การ์ดในคลังอ้างถึง playerId — ถ้าล็อกไปลบข้อมูลต้นแบบ การ์ดของผู้เล่นจะพัง
    expect(PLAYERS.some((player) => player.id === victim.id)).toBe(true);
  });

  it('ปลดล็อกแล้วกลับมาหาได้เหมือนเดิมทุกช่องทาง', () => {
    lock(victim.id);
    expect(getMarketPool().some((player) => player.id === victim.id)).toBe(false);

    setCardLock({ ids: [], note: '' });
    expect(getMarketPool().some((player) => player.id === victim.id)).toBe(true);
  });
});
