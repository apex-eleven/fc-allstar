/**
 * ล็อกการ์ด — กันไม่ให้นักเตะที่แอดมินเลือกไว้หลุดเข้าเกมจากทุกช่องทาง
 *
 * ⚠️ ไฟล์นี้เก็บรายชื่อไว้ที่ระดับโมดูล (เหมือน playerAttributes) ไม่ใช่ใน React state
 * เพราะจุดที่ต้องเช็คส่วนใหญ่เป็น service ล้วน ๆ ที่ไม่ได้อยู่ในต้นไม้ React —
 * เช่น cardPack, market, exchangeRotation ซึ่งเรียก hook ไม่ได้
 * useGameConfig เป็นคนป้อนรายชื่อเข้ามาจุดเดียวผ่าน setLockedPlayerIds()
 *
 * สิ่งที่ล็อก "ทำ" คือกันการได้มาใหม่เท่านั้น:
 *   • หายจากพูลสุ่มทุกอัน (ซอง · ผสมการ์ด · ตลาด · ร้านแลกตามรอบ)
 *   • ของที่แอดมินเลือกไว้เอง (ร้านแต้ม · ดีลแลกการ์ด) จะดับ กดรับไม่ได้
 *   • ด่านสุดท้ายอยู่ที่ usePlayers.addCards — ต่อให้มีทางไหนหลุดมา ก็ไม่เข้าคลัง
 *
 * สิ่งที่ล็อก "ไม่ทำ":
 *   • ไม่ยึดการ์ดที่ผู้เล่นมีอยู่แล้ว — ใช้ ตีบวก จัดทีม ขาย ผสมทิ้ง ได้ครบทุกอย่าง
 *   • ไม่แตะการ์ดชุดเริ่มต้นของบัญชีใหม่ (ล็อกใบในชุดนั้นแล้วบัญชีใหม่จะขาดตัว
 *     จนจัด 11 ตัวจริงไม่ครบ) หน้าแอดมินจึงเตือนไว้แทนที่จะบล็อกให้
 *   • ไม่กันของขวัญที่แอดมินเสกให้เอง — ถือเป็นคำสั่งของแอดมินโดยตรง ไม่ใช่ "หาเจอในเกม"
 *
 * เป็น pure function ล้วน ห้าม import React
 */
import { getPlayerById, PLAYERS } from '@/data/players';
import type { CardLockConfig } from '@/types/cardLock';
import type { Player } from '@/types/player';

/** ข้อความเริ่มต้นที่โชว์ให้ผู้เล่นเห็นตรงของที่ถูกล็อก */
export const CARD_LOCK_DEFAULT_NOTE = 'ยังไม่เปิดให้หาในตอนนี้';

/** ค่าตั้งเริ่มต้น = ไม่ล็อกใครเลย */
export const DEFAULT_CARD_LOCK: CardLockConfig = { ids: [], note: '' };

/** กันเอกสารบวมจนอ่านช้า — มากกว่านี้ควรใช้รายชื่อขาวของแต่ละระบบแทน */
export const CARD_LOCK_MAX = 500;

/** บีบค่าจากเซิร์ฟเวอร์ให้ใช้งานได้จริง (ตัดซ้ำ ตัด id ที่ไม่มีอยู่จริง) */
export const normalizeCardLock = (
  raw: Partial<CardLockConfig> | null | undefined,
): CardLockConfig => {
  const ids = Array.isArray(raw?.ids) ? raw.ids : [];

  return {
    ids: Array.from(new Set(ids.filter((id) => typeof id === 'string' && getPlayerById(id)))).slice(
      0,
      CARD_LOCK_MAX,
    ),
    note: typeof raw?.note === 'string' ? raw.note.slice(0, 120) : '',
  };
};

/* ── ทะเบียนระดับโมดูล ──────────────────────────────────────── */

let LOCKED: ReadonlySet<string> = new Set();
let LOCK_NOTE = '';

/** ใส่รายชื่อที่ล็อกทั้งชุด (เรียกจาก useGameConfig ตอนโหลดค่าตั้ง) */
export const setCardLock = (config: CardLockConfig | null): void => {
  LOCKED = new Set(config?.ids ?? []);
  LOCK_NOTE = config?.note ?? '';
};

/** ล้างรายชื่อทั้งหมด (ใช้ในเทส) */
export const clearCardLock = (): void => {
  LOCKED = new Set();
  LOCK_NOTE = '';
};

/** นักเตะคนนี้ถูกล็อกอยู่ไหม */
export const isPlayerLocked = (playerId: string): boolean => LOCKED.has(playerId);

/** มีการ์ดถูกล็อกอยู่กี่ใบ (0 = ไม่ได้ล็อกอะไรเลย) */
export const lockedCount = (): number => LOCKED.size;

/** ข้อความที่แอดมินตั้งไว้ให้ผู้เล่นเห็น */
export const getCardLockNote = (): string => LOCK_NOTE || CARD_LOCK_DEFAULT_NOTE;

/**
 * ตัดคนที่ถูกล็อกออกจากพูล
 * ใช้กับทุกจุดที่ "สุ่มว่าจะให้ใคร" — ตัดก่อนสุ่มเสมอ ไม่ใช่สุ่มแล้วค่อยตัด
 * ไม่งั้นรอบที่บังเอิญสุ่มติดใบที่ล็อกจะมีของน้อยกว่ารอบอื่นโดยไม่มีเหตุผล
 */
export const filterUnlockedPlayers = <T extends { id: string }>(players: readonly T[]): T[] =>
  players.filter((player) => !LOCKED.has(player.id));

/** ตัด playerId ที่ถูกล็อกออกจากรายชื่อ */
export const filterUnlockedIds = (ids: readonly string[]): string[] =>
  ids.filter((id) => !LOCKED.has(id));

/** นักเตะทุกคนที่ยังหาได้ตามปกติ */
export const getUnlockedPlayers = (): Player[] => filterUnlockedPlayers(PLAYERS);
