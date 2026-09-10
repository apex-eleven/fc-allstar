/**
 * เทสกติกาของโค้ดรับของ
 *
 * เน้นสองเรื่องที่พลาดแล้วเจ็บ:
 *   1. โค้ดที่ปิด/หมดอายุ/เต็มโควตา ต้องถูกปฏิเสธ ไม่ใช่หลุดไปจ่ายของ
 *   2. โค้ดที่ผู้เล่นพิมพ์มาเลอะ ๆ (ตัวเล็ก มีเว้นวรรค) ต้องกลายเป็นรูปเดียวกับที่แอดมินสร้าง
 *      ไม่งั้นผู้เล่นจะเจอ "ไม่พบโค้ดนี้" ทั้งที่พิมพ์ถูก
 */
import { describe, expect, it } from 'vitest';
import {
  checkRedeemable,
  describeCodeStatus,
  emptyCode,
  generateCode,
  isCodeShapeValid,
  normalizeCode,
  normalizeRedeemCode,
  REDEEM_CODE_MAX,
  REDEEM_MAX_REWARDS,
  usableRewards,
} from '@/services/redeemCode';
import type { RedeemCodeDoc } from '@/types/redeem';

const HOUR = 60 * 60 * 1000;
const NOW = Date.UTC(2026, 8, 10, 12, 0, 0);

const codeOf = (patch: Partial<RedeemCodeDoc> = {}): RedeemCodeDoc =>
  normalizeRedeemCode({ ...emptyCode('FCA-TEST', 'admin'), ...patch });

describe('รูปแบบโค้ด', () => {
  it('ตัดช่องว่างและแปลงเป็นตัวพิมพ์ใหญ่', () => {
    expect(normalizeCode('  fca-7k3 pqz ')).toBe('FCA-7K3PQZ');
  });

  it('ตัดความยาวส่วนเกินทิ้ง', () => {
    expect(normalizeCode('A'.repeat(80))).toHaveLength(REDEEM_CODE_MAX);
  });

  it('รับเฉพาะ A-Z 0-9 และขีดกลาง ยาว 4–24', () => {
    expect(isCodeShapeValid('FCA-7K3PQZ')).toBe(true);
    expect(isCodeShapeValid('SEASON2')).toBe(true);
    expect(isCodeShapeValid('ABC')).toBe(false);
    expect(isCodeShapeValid('โค้ดไทย')).toBe(false);
    expect(isCodeShapeValid('FCA_7K3')).toBe(false);
  });

  it('โค้ดที่สุ่มมาต้องผ่านการตรวจของตัวเองเสมอ', () => {
    for (let round = 0; round < 100; round += 1) {
      const code = generateCode();
      expect(isCodeShapeValid(code)).toBe(true);
      expect(normalizeCode(code)).toBe(code);
    }
  });

  it('โค้ดที่สุ่มมาไม่มีตัวที่อ่านสับสน (O 0 I 1) ในส่วนท้าย', () => {
    const body = generateCode('FCA', 12).split('-')[1];
    expect(body).not.toMatch(/[O0I1]/);
  });
});

describe('บีบเอกสารจากเซิร์ฟเวอร์', () => {
  it('ทิ้งรางวัลที่ตั้งค่าไม่ครบ', () => {
    const clean = normalizeRedeemCode({
      code: 'fca-x1',
      rewards: [
        { kind: 'coins', amount: 500 },
        // ไม่มี playerId = จ่ายไม่ได้ ต้องถูกทิ้ง
        { kind: 'card' },
      ],
    });

    expect(clean.code).toBe('FCA-X1');
    expect(clean.rewards).toHaveLength(1);
  });

  it('จำกัดจำนวนรางวัลตามเพดาน', () => {
    const many = Array.from({ length: 50 }, () => ({ kind: 'coins' as const, amount: 1 }));
    expect(normalizeRedeemCode({ rewards: many }).rewards).toHaveLength(REDEEM_MAX_REWARDS);
  });

  it('ค่าตัวเลขติดลบถูกดันขึ้นเป็น 0', () => {
    const clean = normalizeRedeemCode({ maxUses: -5, uses: -3, expiresAtMs: -1 });
    expect(clean.maxUses).toBe(0);
    expect(clean.uses).toBe(0);
    expect(clean.expiresAtMs).toBe(0);
  });
});

describe('ตรวจว่าใช้โค้ดได้ไหม', () => {
  it('โค้ดปกติผ่าน', () => {
    expect(checkRedeemable(codeOf(), { now: NOW })).toBeNull();
  });

  it('ไม่มีโค้ดนี้', () => {
    expect(checkRedeemable(null)).toBe('notFound');
  });

  it('เคยรับไปแล้ว — เช็คก่อนเงื่อนไขอื่นทั้งหมด', () => {
    expect(checkRedeemable(codeOf(), { claimed: true, now: NOW })).toBe('alreadyClaimed');
  });

  it('ปิดอยู่', () => {
    expect(checkRedeemable(codeOf({ enabled: false }), { now: NOW })).toBe('disabled');
  });

  it('หมดอายุแล้ว — วินาทีที่ถึงเวลาพอดีถือว่าหมดแล้ว', () => {
    expect(checkRedeemable(codeOf({ expiresAtMs: NOW }), { now: NOW })).toBe('expired');
    expect(checkRedeemable(codeOf({ expiresAtMs: NOW + HOUR }), { now: NOW })).toBeNull();
  });

  it('ใช้ครบโควตาแล้ว', () => {
    expect(checkRedeemable(codeOf({ maxUses: 10, uses: 10 }), { now: NOW })).toBe('usedUp');
    expect(checkRedeemable(codeOf({ maxUses: 10, uses: 9 }), { now: NOW })).toBeNull();
  });

  it('maxUses = 0 คือไม่จำกัด ใช้ไปเท่าไรก็ยังผ่าน', () => {
    expect(checkRedeemable(codeOf({ maxUses: 0, uses: 99_999 }), { now: NOW })).toBeNull();
  });

  it('ไม่มีของรางวัลก็ให้รับไม่ได้ กันผู้เล่นเสียสิทธิ์ฟรี', () => {
    expect(checkRedeemable(codeOf({ rewards: [] }), { now: NOW })).toBe('noRewards');
  });
});

describe('สถานะที่โชว์ในหน้าแอดมิน', () => {
  it('บอกสถานะตรงกับผลของ checkRedeemable', () => {
    expect(describeCodeStatus(codeOf(), NOW).tone).toBe('live');
    expect(describeCodeStatus(codeOf({ enabled: false }), NOW).tone).toBe('off');
    expect(describeCodeStatus(codeOf({ expiresAtMs: NOW - HOUR }), NOW).tone).toBe('done');
    expect(describeCodeStatus(codeOf({ maxUses: 5, uses: 5 }), NOW).tone).toBe('done');
  });
});

describe('ของที่จ่ายจริง', () => {
  it('คืนเฉพาะชิ้นที่จ่ายได้', () => {
    const code = codeOf({
      rewards: [
        { kind: 'coins', amount: 1000 },
        { kind: 'upgradePoints', amount: 50 },
      ],
    });
    expect(usableRewards(code)).toHaveLength(2);
  });
});
