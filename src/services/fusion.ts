/**
 * ระบบผสมการ์ดนักเตะ (CARD FUSION)
 *
 * กติกาข้อเดียวจบ: เอาการ์ด "ระดับเดียวกัน" มาผสม → ได้การ์ดระดับเดิม 1 ใบ
 * แต่เป็นนักเตะคนใหม่ที่สุ่มมา พร้อมค่าตีบวก +1 ถึง +8 ที่สุ่มเช่นกัน
 *
 *   • ระดับ = rarity ของนักเตะ (common → mythical) ไม่ใช่ค่าตีบวก
 *     ผสม legendary มา ก็ได้ legendary กลับไปเสมอ ระดับไม่มีทางตกหรือขึ้น
 *   • ค่าตีบวกของ "วัสดุ" มีผลกับโอกาส โดยดูจากใบที่บวกน้อยที่สุด (ดู getMaterialPlus)
 *   • ค่าเริ่มต้น: +8 ครบทุกใบ → โอกาสออก +8 เท่ากับ 20% พอดี
 *   • ค่าเริ่มต้น: +7 ขึ้นไปครบทุกใบ → มีโอกาสได้เงินก้อน 1–2 ล้านแถมมาด้วย
 *
 * ⚠️ ทุกตัวเลขในไฟล์นี้เป็นแค่ "ค่าเริ่มต้น" — ของจริงที่เกมใช้มาจาก config/fusion
 * ที่แอดมินตั้งไว้ (ADMIN → ผสมการ์ด) ฟังก์ชันทุกตัวจึงรับ FusionConfig เข้ามา
 * อย่าใส่ตัวเลขตายตัวกลับเข้าไปในตรรกะอีก ไม่งั้นค่าที่แอดมินตั้งจะไม่มีผล
 *
 * ⚠️ ทำไมใช้ "ใบที่บวกน้อยที่สุด" ไม่ใช่ค่าเฉลี่ย
 * เพราะเงื่อนไขของเกมพูดแบบ "ครบทุกใบ" (+8 ครบ 3 ใบ / +7 ขึ้นไปครบ 3 ใบ)
 * ค่าต่ำสุดคือตัวเดียวที่ตอบคำถามนั้นได้ตรง ๆ ถ้าใช้ค่าเฉลี่ยจะเปิดช่องให้
 * เอา +8 สองใบ + ใบขยะหนึ่งใบมาไต่โอกาสได้ ซึ่งผิดเจตนาของกติกา
 *
 * เป็น pure function ล้วน ห้าม import React หรือแตะ state
 */
import { PLAYERS } from '@/data/players';
import { MAX_UPGRADE } from '@/data/upgradeConfig';
import { getCardUpgrade, isCardLocked } from '@/services/cardInstance';
import { isPlayerLocked } from '@/services/cardLock';
import { getBasePlayer } from '@/services/playerAttributes';
import type { CardInstance } from '@/types/card';
import type { FusionConfig } from '@/types/fusion';
import type { Player, Rarity } from '@/types/player';
import { clamp, createId, pickRandom } from '@/utils/helpers';

/* ── ขอบเขตที่ยอมให้แอดมินตั้ง ──────────────────────────────── */

/** ผลลัพธ์ต่ำสุดที่ผสมออกมาได้ (+0 ไม่มีทางออก เพราะผสมแล้วต้องได้อะไรกลับไปเสมอ) */
export const FUSION_MIN_PLUS = 1;
/** ผลลัพธ์สูงสุด = เพดานตีบวกของทั้งเกม */
export const FUSION_MAX_PLUS = MAX_UPGRADE;
/** จำนวนช่องในหนึ่งแถวของตารางโอกาส (+1 ถึง +8) */
export const FUSION_ODDS_COLUMNS = FUSION_MAX_PLUS - FUSION_MIN_PLUS + 1;

export const FUSION_LIMITS = {
  materials: { min: 2, max: 5 },
  candidates: { min: 1, max: 8 },
} as const;

/** ตารางน้ำหนักเริ่มต้น — คีย์คือค่าบวกต่ำสุดของวัสดุ ค่าคือน้ำหนักของผล +1 … +8 */
export const DEFAULT_FUSION_ODDS: Record<string, number[]> = {
  '0': [45, 27, 15, 8, 3, 1.4, 0.5, 0.1],
  '1': [38, 28, 17, 9, 4.5, 2, 1, 0.5],
  '2': [30, 27, 20, 12, 6, 3, 1.4, 0.6],
  '3': [22, 24, 22, 15, 9, 5, 2, 1],
  '4': [15, 20, 22, 18, 12, 8, 3.5, 1.5],
  '5': [10, 15, 20, 20, 16, 11, 5, 3],
  '6': [6, 10, 16, 20, 19, 15, 9, 5],
  '7': [3, 6, 11, 16, 20, 20, 14, 10],
  // แถวนี้คือข้อกำหนดตรง ๆ ของเกม: ใช้ +8 ครบทุกใบ โอกาสออก +8 = 20%
  '8': [1, 3, 6, 11, 17, 20, 22, 20],
};

/** ค่าตั้งเริ่มต้นเมื่อแอดมินยังไม่เคยตั้งอะไรเลย */
export const DEFAULT_FUSION: FusionConfig = {
  enabled: true,
  materials: 3,
  candidates: 5,
  odds: DEFAULT_FUSION_ODDS,
  cashEnabled: true,
  cashMinPlus: 7,
  cashChance: 0.3,
  cashMin: 1_000_000,
  cashMax: 2_000_000,
  cashStep: 100_000,
};

/* ── บีบค่าจากเซิร์ฟเวอร์ให้อยู่ในกรอบ ──────────────────────── */

const num = (value: unknown, fallback: number, min: number, max: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? clamp(parsed, min, max) : fallback;
};

/**
 * ซ่อมหนึ่งแถวของตารางโอกาส
 * ต้องมีครบ 8 ช่อง ค่าติดลบถือเป็น 0 และถ้าทั้งแถวเป็น 0 หมด (สุ่มไม่ได้เลย)
 * ให้ถอยไปใช้แถวเริ่มต้นแทน ดีกว่าปล่อยให้ผู้เล่นกดผสมแล้วเกมค้าง
 */
const normalizeOddsRow = (raw: unknown, fallback: number[]): number[] => {
  if (!Array.isArray(raw)) return [...fallback];

  const row = Array.from({ length: FUSION_ODDS_COLUMNS }, (_, index) =>
    Math.max(0, num(raw[index], 0, 0, 1_000_000)),
  );

  return row.some((weight) => weight > 0) ? row : [...fallback];
};

/** บีบค่าตั้งทั้งชุดให้ใช้งานได้จริง — เรียกทั้งตอนอ่านจากเซิร์ฟเวอร์และตอนบันทึก */
export const normalizeFusion = (raw: Partial<FusionConfig> | null | undefined): FusionConfig => {
  const odds: Record<string, number[]> = {};
  for (let plus = 0; plus <= MAX_UPGRADE; plus += 1) {
    const key = String(plus);
    odds[key] = normalizeOddsRow(raw?.odds?.[key], DEFAULT_FUSION_ODDS[key]);
  }

  const cashMin = Math.round(num(raw?.cashMin, DEFAULT_FUSION.cashMin, 0, 1_000_000_000));
  const cashMax = Math.round(num(raw?.cashMax, DEFAULT_FUSION.cashMax, 0, 1_000_000_000));

  return {
    enabled: raw?.enabled !== false,
    materials: Math.round(
      num(
        raw?.materials,
        DEFAULT_FUSION.materials,
        FUSION_LIMITS.materials.min,
        FUSION_LIMITS.materials.max,
      ),
    ),
    candidates: Math.round(
      num(
        raw?.candidates,
        DEFAULT_FUSION.candidates,
        FUSION_LIMITS.candidates.min,
        FUSION_LIMITS.candidates.max,
      ),
    ),
    odds,
    cashEnabled: raw?.cashEnabled !== false,
    cashMinPlus: Math.round(num(raw?.cashMinPlus, DEFAULT_FUSION.cashMinPlus, 0, MAX_UPGRADE)),
    cashChance: num(raw?.cashChance, DEFAULT_FUSION.cashChance, 0, 1),
    cashMin: Math.min(cashMin, cashMax),
    // สลับให้เองเมื่อกรอกกลับด้าน ดีกว่าปฏิเสธการบันทึกแล้วแอดมินงงว่าทำไมเซฟไม่ได้
    cashMax: Math.max(cashMin, cashMax),
    cashStep: Math.max(1, Math.round(num(raw?.cashStep, DEFAULT_FUSION.cashStep, 1, 1_000_000_000))),
  };
};

/* ── อ่านค่าจากชุดวัสดุ ─────────────────────────────────────── */

/**
 * ค่าบวกที่ใช้ตัดสินโอกาส = ใบที่บวกน้อยที่สุดในชุด
 * ชุดว่าง = 0 (ยังไม่ได้เลือกอะไร ให้โชว์แถวแย่ที่สุดไปก่อน)
 */
export const getMaterialPlus = (cards: Array<Pick<CardInstance, 'level'>>): number => {
  if (cards.length === 0) return 0;
  return cards.reduce((low, card) => Math.min(low, getCardUpgrade(card)), MAX_UPGRADE);
};

/** ระดับการ์ดของชุดนี้ — คืน null ถ้าระดับไม่ตรงกันหรือหานักเตะไม่เจอ */
export const getMaterialRarity = (cards: Array<Pick<CardInstance, 'playerId'>>): Rarity | null => {
  if (cards.length === 0) return null;

  const rarities = cards.map((card) => getBasePlayer(card.playerId)?.rarity);
  if (rarities.some((rarity) => !rarity)) return null;

  return rarities.every((rarity) => rarity === rarities[0]) ? (rarities[0] as Rarity) : null;
};

/** น้ำหนักดิบของแถวนี้ (ยังไม่คิดเป็นเปอร์เซ็นต์) */
export const getFusionWeights = (materialPlus: number, config: FusionConfig): number[] => {
  const key = String(clamp(Math.trunc(materialPlus), 0, MAX_UPGRADE));
  return config.odds[key] ?? DEFAULT_FUSION_ODDS[key] ?? DEFAULT_FUSION_ODDS['0'];
};

/**
 * ตารางโอกาสของชุดวัสดุระดับนี้ ในรูปเปอร์เซ็นต์ที่เอาไปโชว์บน UI ได้เลย
 *
 * คิดเป็นสัดส่วนของน้ำหนักรวมเสมอ แอดมินจึงไม่ต้องนั่งบวกให้ครบ 100
 * และค่าที่ผู้เล่นเห็นก็ตรงกับโอกาสจริงที่ระบบสุ่มเสมอ
 */
export const getFusionOdds = (
  materialPlus: number,
  config: FusionConfig,
): Array<{ plus: number; chance: number }> => {
  const weights = getFusionWeights(materialPlus, config);
  const total = weights.reduce((sum, weight) => sum + weight, 0) || 1;

  return weights.map((weight, index) => ({
    plus: FUSION_MIN_PLUS + index,
    chance: (weight / total) * 100,
  }));
};

/** ชุดนี้มีสิทธิ์ลุ้นเงินก้อนไหม */
export const canWinCash = (materialPlus: number, config: FusionConfig): boolean =>
  config.cashEnabled && materialPlus >= config.cashMinPlus;

/* ── กติกาว่าการ์ดใบไหนเอามาผสมได้ ──────────────────────────── */

/** เหตุผลที่การ์ดใบนี้ผสมไม่ได้ — null = ใช้ได้ */
export type FusionBlockReason = 'locked' | 'inSquad' | 'rarity';

export interface FusionEligibility {
  /** id ของการ์ดที่ลงสนาม/นั่งสำรองอยู่ (ห้ามเอามาผสม) */
  usedCardIds: Set<string>;
  /** ระดับที่ล็อกไว้แล้วจากใบแรกที่เลือก — null = ยังเลือกได้ทุกระดับ */
  rarity: Rarity | null;
}

/**
 * ตรวจว่าการ์ดใบนี้หย่อนลงช่องผสมได้ไหม
 * แยกออกมาเป็นฟังก์ชันเดียวเพราะทั้งหน้าเลือกการ์ดและตอนกดยืนยันต้องใช้กติกาชุดเดียวกัน
 */
export const getFusionBlockReason = (
  card: CardInstance,
  { usedCardIds, rarity }: FusionEligibility,
): FusionBlockReason | null => {
  if (isCardLocked(card)) return 'locked';
  if (usedCardIds.has(card.id)) return 'inSquad';

  const cardRarity = getBasePlayer(card.playerId)?.rarity;
  if (!cardRarity) return 'rarity';
  if (rarity && cardRarity !== rarity) return 'rarity';

  return null;
};

/** ข้อความอธิบายเหตุผลที่ใช้ใบนี้ไม่ได้ */
export const FUSION_BLOCK_TEXT: Record<FusionBlockReason, string> = {
  locked: 'การ์ดใบนี้ถูกล็อกไว้',
  inSquad: 'การ์ดใบนี้อยู่ในทีมตัวจริง/สำรอง',
  rarity: 'ต้องเป็นการ์ดระดับเดียวกันทุกใบ',
};

/* ── การสุ่มผลลัพธ์ ─────────────────────────────────────────── */

/** นักเตะทุกคนที่ผสมออกมาได้ในระดับนี้ */
export const getFusionPool = (rarity: Rarity): Player[] =>
  PLAYERS.filter((player) => player.rarity === rarity && !isPlayerLocked(player.id));

/** ผลที่ซ่อนอยู่ในการ์ดคว่ำหนึ่งใบ */
export interface FusionCandidate {
  id: string;
  playerId: string;
  /** ค่าตีบวกของการ์ดที่จะได้ (1–8) */
  plus: number;
  /** เงินก้อนที่แถมมา (0 = ไม่ได้) */
  cash: number;
}

/** สุ่มค่าตีบวกหนึ่งค่าตามน้ำหนักของชุดวัสดุ */
export const rollFusionPlus = (
  materialPlus: number,
  config: FusionConfig,
  random = Math.random,
): number => {
  const weights = getFusionWeights(materialPlus, config);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) return FUSION_MIN_PLUS;

  let ticket = random() * total;
  for (let index = 0; index < weights.length; index += 1) {
    ticket -= weights[index];
    if (ticket <= 0) return FUSION_MIN_PLUS + index;
  }
  return FUSION_MIN_PLUS + weights.length - 1;
};

/**
 * สุ่มเงินก้อนแถม — คืน 0 เมื่อไม่เข้าเงื่อนไขหรือดวงไม่ถึง
 * เรียกครั้งเดียวต่อการ์ดคว่ำหนึ่งใบ
 */
export const rollFusionCash = (
  materialPlus: number,
  config: FusionConfig,
  random = Math.random,
): number => {
  if (!canWinCash(materialPlus, config)) return 0;
  if (random() >= config.cashChance) return 0;

  const steps = Math.floor((config.cashMax - config.cashMin) / config.cashStep) + 1;
  return config.cashMin + Math.floor(random() * Math.max(1, steps)) * config.cashStep;
};

/**
 * สุ่มผลของการ์ดคว่ำครบทุกใบในครั้งเดียว
 *
 * ⚠️ ทุกใบสุ่มด้วยตารางเดียวกันและเป็นอิสระต่อกัน ผู้เล่นจะเปิดใบไหนก่อนก็ได้
 * โอกาสเท่ากันหมด — การเลือกช่องเป็นเรื่องบรรยากาศล้วน ไม่มีใบไหน "ดีกว่า" ซ่อนอยู่
 */
export const rollFusionCandidates = (
  rarity: Rarity,
  materialPlus: number,
  config: FusionConfig,
  random = Math.random,
): FusionCandidate[] => {
  const pool = getFusionPool(rarity);
  const fallback = pool.length > 0 ? pool : PLAYERS;

  return Array.from({ length: config.candidates }, () => ({
    id: createId('fuse'),
    playerId: pickRandom(fallback).id,
    plus: rollFusionPlus(materialPlus, config, random),
    cash: rollFusionCash(materialPlus, config, random),
  }));
};
