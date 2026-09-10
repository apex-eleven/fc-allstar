/**
 * กติกาของโค้ดรับของ — ส่วนที่ไม่แตะเน็ตเวิร์กเลย
 *
 * แยกออกมาเพราะทั้งฝั่งผู้เล่น (ตรวจก่อนยิง) ฝั่งแอดมิน (ตรวจก่อนบันทึก)
 * และกฎ Firestore ต้องเห็นตรงกันว่าโค้ดหน้าตาแบบไหนใช้ได้ ถ้าปล่อยให้แต่ละที่
 * ตรวจกันเอง จะมีเคสที่หน้าเว็บบอกว่าโค้ดถูกแต่เซิร์ฟเวอร์ปฏิเสธ แล้วหาสาเหตุยาก
 *
 * ⚠️ ตัวอักษรที่ใช้ได้จงใจตัด O, 0, I, 1 ออกจากตัวสุ่ม เพราะผู้เล่นส่วนใหญ่
 * อ่านโค้ดจากรูปภาพหรือคลิปแล้วพิมพ์ตาม ตัวที่หน้าตาซ้ำกันทำให้พิมพ์ผิดบ่อยมาก
 * (แต่ตอน "ตรวจ" ยังรับทุกตัวอักษร เผื่อแอดมินอยากตั้งโค้ดคำอ่านง่ายเอง เช่น SEASON2)
 *
 * เป็น pure function ล้วน ห้าม import React หรือ firebase
 */
import { isRewardValid, normalizeReward } from '@/services/rewards';
import type { RedeemCodeDoc, RedeemFailure } from '@/types/redeem';
import type { GameReward } from '@/types/reward';

/** ความยาวโค้ดที่ยอมรับ */
export const REDEEM_CODE_MIN = 4;
export const REDEEM_CODE_MAX = 24;

/** จำนวนรางวัลต่อโค้ด — ต้องตรงกับเพดานใน firestore.rules */
export const REDEEM_MAX_REWARDS = 20;

/** ตัวอักษรที่ใช้ตอนสุ่มโค้ด (ตัด O 0 I 1 ออกกันอ่านสับสน) */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** รูปแบบโค้ดที่ยอมรับ — อังกฤษตัวใหญ่ ตัวเลข และขีดกลาง */
const CODE_PATTERN = /^[A-Z0-9-]+$/;

/**
 * ทำโค้ดที่ผู้เล่นพิมพ์มาให้เป็นรูปมาตรฐาน
 * ตัดช่องว่างทุกจุด (คนชอบเว้นวรรคตามที่เห็นในรูป) และแปลงเป็นตัวพิมพ์ใหญ่
 * ผลลัพธ์ของฟังก์ชันนี้คือ id ของเอกสารเสมอ — ฝั่งไหนก็ต้องเรียกก่อนใช้งาน
 */
export const normalizeCode = (raw: string): string =>
  raw.replace(/\s+/g, '').toUpperCase().slice(0, REDEEM_CODE_MAX);

/** โค้ดนี้หน้าตาถูกต้องไหม (ยังไม่ได้เช็คว่ามีอยู่จริง) */
export const isCodeShapeValid = (code: string): boolean =>
  code.length >= REDEEM_CODE_MIN && code.length <= REDEEM_CODE_MAX && CODE_PATTERN.test(code);

/** สุ่มโค้ดใหม่หนึ่งอัน เช่น FCA-7K3PQZ */
export const generateCode = (prefix = 'FCA', length = 6, random = Math.random): string => {
  const body = Array.from(
    { length },
    () => CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)],
  ).join('');

  const head = normalizeCode(prefix);
  return head ? `${head}-${body}` : body;
};

/** ข้อความอธิบายว่าทำไมใช้โค้ดนี้ไม่ได้ */
export const REDEEM_FAILURE_TEXT: Record<RedeemFailure, string> = {
  empty: 'กรอกโค้ดก่อนนะ',
  format: 'โค้ดไม่ถูกรูปแบบ (ใช้ได้เฉพาะ A-Z, 0-9 และขีดกลาง)',
  notFound: 'ไม่พบโค้ดนี้ ลองตรวจตัวสะกดอีกครั้ง',
  disabled: 'โค้ดนี้ถูกปิดใช้งานอยู่',
  expired: 'โค้ดนี้หมดอายุแล้ว',
  usedUp: 'โค้ดนี้ถูกใช้ครบจำนวนแล้ว',
  alreadyClaimed: 'คุณรับของจากโค้ดนี้ไปแล้ว',
  noRewards: 'โค้ดนี้ยังไม่ได้ตั้งของรางวัล',
  offline: 'ตอนนี้ต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง',
  failed: 'รับของไม่สำเร็จ ลองใหม่อีกครั้ง',
};

/** ค่าเริ่มต้นของโค้ดใหม่ที่แอดมินเพิ่งกดสร้าง */
export const emptyCode = (code: string, createdBy: string): RedeemCodeDoc => ({
  code,
  rewards: [{ kind: 'coins', amount: 100_000 }],
  note: '',
  enabled: true,
  maxUses: 0,
  uses: 0,
  expiresAtMs: 0,
  createdAt: new Date().toISOString(),
  createdBy,
});

/** บีบเอกสารจากเซิร์ฟเวอร์ให้ใช้งานได้จริง — ฝั่งรับไม่เชื่อค่าในเอกสารทั้งดุ้น */
export const normalizeRedeemCode = (
  raw: Partial<RedeemCodeDoc> | null | undefined,
  fallbackCode = '',
): RedeemCodeDoc => {
  const rewards = Array.isArray(raw?.rewards) ? raw.rewards : [];

  return {
    code: normalizeCode(String(raw?.code ?? fallbackCode)),
    rewards: rewards.slice(0, REDEEM_MAX_REWARDS).map(normalizeReward).filter(isRewardValid),
    note: typeof raw?.note === 'string' ? raw.note.slice(0, 200) : '',
    enabled: raw?.enabled !== false,
    maxUses: Math.max(0, Math.floor(Number(raw?.maxUses) || 0)),
    uses: Math.max(0, Math.floor(Number(raw?.uses) || 0)),
    expiresAtMs: Math.max(0, Math.floor(Number(raw?.expiresAtMs) || 0)),
    createdAt: typeof raw?.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
    createdBy: typeof raw?.createdBy === 'string' ? raw.createdBy.slice(0, 40) : '',
  };
};

/**
 * โค้ดนี้ใช้ได้ตอนนี้ไหม — คืนเหตุผลที่ใช้ไม่ได้ หรือ null เมื่อผ่าน
 *
 * ⚠️ ทุกเงื่อนไขในนี้ถูกบังคับซ้ำอีกชั้นใน firestore.rules
 * ตรงนี้มีไว้ให้ข้อความบอกผู้เล่นได้ตรงจุด ไม่ใช่ด่านกันโกง
 */
export const checkRedeemable = (
  code: RedeemCodeDoc | null,
  { claimed = false, now = Date.now() }: { claimed?: boolean; now?: number } = {},
): RedeemFailure | null => {
  if (!code) return 'notFound';
  if (claimed) return 'alreadyClaimed';
  if (!code.enabled) return 'disabled';
  if (code.expiresAtMs > 0 && now >= code.expiresAtMs) return 'expired';
  if (code.maxUses > 0 && code.uses >= code.maxUses) return 'usedUp';
  if (code.rewards.length === 0) return 'noRewards';
  return null;
};

/** สรุปสถานะของโค้ดไว้โชว์ในตารางฝั่งแอดมิน */
export const describeCodeStatus = (
  code: RedeemCodeDoc,
  now = Date.now(),
): { label: string; tone: 'live' | 'off' | 'done' } => {
  if (!code.enabled) return { label: 'ปิดอยู่', tone: 'off' };
  if (code.expiresAtMs > 0 && now >= code.expiresAtMs) return { label: 'หมดอายุ', tone: 'done' };
  if (code.maxUses > 0 && code.uses >= code.maxUses) return { label: 'ใช้ครบแล้ว', tone: 'done' };
  if (code.rewards.length === 0) return { label: 'ยังไม่มีของ', tone: 'off' };
  return { label: 'ใช้ได้', tone: 'live' };
};

/** ของทั้งหมดในโค้ดนี้ที่จ่ายได้จริง */
export const usableRewards = (code: RedeemCodeDoc): GameReward[] =>
  code.rewards.map(normalizeReward).filter(isRewardValid);
