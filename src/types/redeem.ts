/**
 * โค้ดรับของ (redeem code) — ADMIN → โค้ดรับของ
 *
 * แอดมินสร้างโค้ดหนึ่งชุด แจกให้ผู้เล่นทางไหนก็ได้ (Facebook, Discord, ในเกม)
 * ผู้เล่นพิมพ์โค้ดในหน้า Redeem แล้วของเข้าบัญชีทันที
 *
 * เอกสารอยู่ที่ redeemCodes/{CODE} และมีคนกดรับใครบ้างอยู่ที่ redeemCodes/{CODE}/claims/{uid}
 * ที่แยกใบรับออกมาเป็นเอกสารของแต่ละคน เพราะกฎ Firestore บังคับ "หนึ่งคนหนึ่งใบ" ได้ตรง ๆ
 * ด้วยสิทธิ์ create เท่านั้น — ผู้เล่นจึงกดรับซ้ำไม่ได้แม้จะแก้โค้ดหน้าเว็บเอง
 */
import type { GameReward } from '@/types/reward';

export interface RedeemCodeDoc {
  /** ตัวโค้ด ตัวพิมพ์ใหญ่ล้วน — เป็น id ของเอกสารด้วย */
  code: string;
  /** ของที่จะได้เมื่อกรอกโค้ดสำเร็จ */
  rewards: GameReward[];
  /** ข้อความที่โชว์ให้ผู้เล่นเห็นตอนรับสำเร็จ (ว่างได้) */
  note: string;
  /** false = ปิดโค้ดชั่วคราวโดยไม่ต้องลบทิ้ง */
  enabled: boolean;
  /** รับได้รวมกี่ครั้ง — 0 = ไม่จำกัด */
  maxUses: number;
  /** ถูกรับไปแล้วกี่ครั้ง */
  uses: number;
  /** เวลาหมดอายุเป็นมิลลิวินาที — 0 = ไม่มีวันหมดอายุ (กฎ Firestore อ่านช่องนี้) */
  expiresAtMs: number;
  /** เวลาที่สร้าง (ISO) */
  createdAt: string;
  /** ชื่อแอดมินที่สร้าง ไว้ไล่ดูย้อนหลัง */
  createdBy: string;
}

/** เหตุผลที่โค้ดใช้ไม่ได้ — null = ใช้ได้ */
export type RedeemFailure =
  | 'empty'
  | 'format'
  | 'notFound'
  | 'disabled'
  | 'expired'
  | 'usedUp'
  | 'alreadyClaimed'
  | 'noRewards'
  | 'offline'
  | 'failed';

/** ผลของการกดรับหนึ่งครั้ง */
export interface RedeemResult {
  ok: boolean;
  /** ข้อความที่เอาไปโชว์ได้เลย */
  message: string;
  /** ของที่ได้จริง (เฉพาะตอนสำเร็จ) */
  rewards: GameReward[];
  reason: RedeemFailure | null;
}
