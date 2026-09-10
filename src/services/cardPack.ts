/**
 * ระบบเปิดซองการ์ด
 *
 * ซองหนึ่งใบมีสามส่วน:
 *   odds         โอกาสได้แต่ละระดับ (common → mythical) รวมกันได้ 100 ต่อการ์ด 1 ใบ
 *   pool         รายชื่อนักเตะที่ใส่ไว้ในซองนั้นโดยเฉพาะ (ไม่ใส่ = สุ่มจากนักเตะทั้งเกม)
 *   upgradeOdds  โอกาสที่การ์ดจะออกมาพร้อมค่าตีบวก +0 ถึง +8 (ไม่ใส่ = +0 ทุกใบ)
 *
 * เวลาเปิดซองจะสุ่ม rarity ก่อน แล้วค่อยสุ่มคนจาก pool ของซองในระดับนั้น
 * แล้วสุ่มค่าตีบวกเป็นครั้งที่สาม แยกขาดจากสองอย่างแรก
 *
 * ⚠️ ค่าตีบวกสุ่ม "ต่อการ์ดหนึ่งใบ" ไม่ใช่ต่อซอง เปิดซองที่ได้ 5 ใบ
 * แต่ละใบจึงลุ้นค่าบวกของตัวเองแยกกัน
 * ทั้งไฟล์เป็น pure function — ผู้เรียก (useCardPack) เป็นคนหักเหรียญและบันทึกลงคลัง
 */
import { CARD_PACKS } from '@/data/cards';
import { PLAYERS } from '@/data/players';
import { isPlayerLocked } from '@/services/cardLock';
import { MAX_UPGRADE } from '@/data/upgradeConfig';
import { createCardInstance } from '@/services/cardInstance';
import type { CardPack, PackOpenResult, PlayerCard as PlayerCardData } from '@/types/card';
import { RARITY_ORDER, type Player, type Rarity } from '@/types/player';
import { pickRandom } from '@/utils/helpers';

export const getPackById = (packId: string): CardPack | undefined =>
  CARD_PACKS.find((pack) => pack.id === packId);

/** ระดับที่ซองนี้มีโอกาสออก เรียงจากดีที่สุดลงมา */
export const getPackRarities = (pack: CardPack): Rarity[] =>
  [...RARITY_ORDER].reverse().filter((rarity) => (pack.odds[rarity] ?? 0) > 0);

/**
 * นักเตะทุกคนที่ซองนี้มีโอกาสออก
 * ถ้าซองกำหนด pool ไว้ จะจำกัดอยู่แค่คนในรายชื่อนั้น
 * เรียงจาก OVR สูงไปต่ำ เพื่อให้หยิบใบเด่นไปโชว์หน้าซองได้ทันที
 */
export const getPackPlayers = (pack: CardPack): Player[] => {
  const rarities = new Set(getPackRarities(pack));
  const allowed = pack.pool ? new Set(pack.pool) : null;

  // การ์ดที่แอดมินล็อกไว้ถูกตัดตรงนี้จุดเดียว จึงหายทั้งจากการสุ่มและจากหน้า "ดูนักเตะในซอง"
  return PLAYERS.filter(
    (player) =>
      rarities.has(player.rarity) &&
      (!allowed || allowed.has(player.id)) &&
      !isPlayerLocked(player.id),
  ).sort((a, b) => b.ovr - a.ovr);
};

/**
 * ใบเด่นที่โชว์อยู่หน้าซอง = คนที่ OVR สูงที่สุดในซองนี้
 *
 * ถ้ามีหลายคน OVR เท่ากันสูงสุด จะเลือกด้วยชื่อซองเป็นตัวตั้ง (ไม่สุ่ม)
 * เพื่อให้ซองแต่ละใบในร้านโชว์คนละหน้า และหน้าซองไม่เปลี่ยนไปมาทุกครั้งที่รีเฟรช
 */
export const getPackHighlight = (pack: CardPack): Player | undefined => {
  const players = getPackPlayers(pack);
  if (players.length === 0) return undefined;

  const top = players.filter((player) => player.ovr === players[0].ovr);
  const seed = [...pack.id].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) % 9973, 7);

  return top[seed % top.length];
};

/** จัดนักเตะในซองเป็นกลุ่มตามระดับ ใช้ในหน้าต่าง "ดูนักเตะในซอง" */
export const getPackPlayersByRarity = (
  pack: CardPack,
): Array<{ rarity: Rarity; chance: number; players: Player[] }> => {
  const players = getPackPlayers(pack);

  return getPackRarities(pack).map((rarity) => ({
    rarity,
    chance: pack.odds[rarity] ?? 0,
    players: players.filter((player) => player.rarity === rarity),
  }));
};

/**
 * แปลง odds เป็นข้อความสำหรับโชว์บนหน้าร้าน เช่น "rare 5% · epic 2.5%"
 * ตัด common ออกเพราะเป็นค่าที่เหลือเสมอ และตอนนี้มี 5 ระดับแล้ว บรรทัดจะยาวเกินช่อง
 */
export const formatOdds = (pack: CardPack): string =>
  (Object.entries(pack.odds) as Array<[Rarity, number]>)
    .filter(([rarity, chance]) => chance > 0 && rarity !== 'common')
    .map(([rarity, chance]) => `${rarity} ${chance}%`)
    .join(' · ');

/** โอกาสได้การ์ดระดับ mythical ของซองนี้ (0 = ซองนี้ไม่มีทางออก) */
export const getMythicalChance = (pack: CardPack): number => pack.odds.mythical ?? 0;

/** สุ่มระดับความหายากหนึ่งใบตามน้ำหนักใน odds */
export const rollRarity = (pack: CardPack): Rarity => {
  const entries = (Object.entries(pack.odds) as Array<[Rarity, number]>).filter(
    ([, chance]) => chance > 0,
  );
  const total = entries.reduce((sum, [, chance]) => sum + chance, 0);

  let ticket = Math.random() * total;
  for (const [rarity, chance] of entries) {
    ticket -= chance;
    if (ticket <= 0) return rarity;
  }
  return entries[entries.length - 1][0];
};

/* ── ค่าตีบวกที่ติดมากับการ์ดในซอง ─────────────────────────── */

/** จำนวนช่องของตารางค่าตีบวก = +0 ถึง +8 */
export const PACK_UPGRADE_COLUMNS = MAX_UPGRADE + 1;

/**
 * ชุดน้ำหนักสำเร็จรูปไว้ให้แอดมินกดใช้ทันที
 * ตัวเลขเป็นน้ำหนัก ไม่ใช่เปอร์เซ็นต์ — เทียบกันเองภายในแถว
 */
export const PACK_UPGRADE_PRESETS: Record<string, { label: string; odds: number[] }> = {
  none: { label: 'ไม่สุ่ม (+0 ทุกใบ)', odds: [100, 0, 0, 0, 0, 0, 0, 0, 0] },
  light: { label: 'บวกน้อย (+1 ถึง +3)', odds: [0, 55, 30, 15, 0, 0, 0, 0, 0] },
  standard: { label: 'มาตรฐาน (+1 ถึง +8)', odds: [0, 40, 25, 15, 10, 5, 3, 1.5, 0.5] },
  premium: { label: 'ซองพรีเมียม (เน้นบวกสูง)', odds: [0, 10, 15, 20, 20, 15, 10, 7, 3] },
  jackpot: { label: 'แจ็กพอต (+5 ขึ้นไปล้วน)', odds: [0, 0, 0, 0, 0, 40, 30, 20, 10] },
};

/**
 * บีบตารางค่าตีบวกให้ใช้งานได้จริง
 * คืน undefined เมื่อซองนี้ไม่ได้ตั้งค่าตีบวกไว้ หรือตั้งมาแล้วใช้ไม่ได้ (เป็น 0 หมด)
 * → ผู้เรียกถอยไปเป็น +0 ทุกใบเหมือนซองปกติ
 */
export const normalizePackUpgradeOdds = (raw: unknown): number[] | undefined => {
  if (!Array.isArray(raw)) return undefined;

  const row = Array.from({ length: PACK_UPGRADE_COLUMNS }, (_, index) => {
    const value = Number(raw[index]);
    return Number.isFinite(value) ? Math.max(0, Math.min(1_000_000, value)) : 0;
  });

  return row.some((weight) => weight > 0) ? row : undefined;
};

/** ซองนี้มีโอกาสออกการ์ดที่บวกมาแล้วไหม (ใช้ติดป้ายในร้าน) */
export const packRollsUpgrade = (pack: CardPack): boolean => {
  const odds = normalizePackUpgradeOdds(pack.upgradeOdds);
  if (!odds) return false;
  // ตั้งไว้แต่ให้น้ำหนัก +0 อย่างเดียว = ไม่ต่างจากซองปกติ ไม่ต้องติดป้ายให้เข้าใจผิด
  return odds.slice(1).some((weight) => weight > 0);
};

/** ช่วงค่าตีบวกที่ซองนี้ออกได้จริง — คืน null เมื่อซองไม่สุ่มค่าตีบวก */
export const getPackUpgradeRange = (pack: CardPack): { min: number; max: number } | null => {
  const odds = normalizePackUpgradeOdds(pack.upgradeOdds);
  if (!odds || !packRollsUpgrade(pack)) return null;

  const hit = odds.map((weight, plus) => ({ weight, plus })).filter((entry) => entry.weight > 0);
  return { min: hit[0].plus, max: hit[hit.length - 1].plus };
};

/** ตารางโอกาสค่าตีบวกในรูปเปอร์เซ็นต์ ไว้โชว์ทั้งฝั่งร้านและฝั่งแอดมิน */
export const getPackUpgradeChances = (
  pack: CardPack,
): Array<{ plus: number; chance: number }> => {
  const odds = normalizePackUpgradeOdds(pack.upgradeOdds);
  if (!odds) return [];

  const total = odds.reduce((sum, weight) => sum + weight, 0) || 1;
  return odds.map((weight, plus) => ({ plus, chance: (weight / total) * 100 }));
};

/** สุ่มค่าตีบวกของการ์ดหนึ่งใบ — ซองที่ไม่ได้ตั้งไว้คืน 0 เสมอ */
export const rollPackUpgrade = (pack: CardPack, random = Math.random): number => {
  const odds = normalizePackUpgradeOdds(pack.upgradeOdds);
  if (!odds) return 0;

  const total = odds.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) return 0;

  let ticket = random() * total;
  for (let plus = 0; plus < odds.length; plus += 1) {
    ticket -= odds[plus];
    if (ticket <= 0) return plus;
  }
  return odds.length - 1;
};

/**
 * เปิดซอง: สุ่ม rarity ต่อการ์ด แล้วสุ่มคนจากนักเตะในซองระดับนั้น
 * ถ้าซองไม่มีคนในระดับที่สุ่มได้ (เช่น pool ใส่มาไม่ครบ) จะถอยไปหยิบใบใดก็ได้ในซองแทน
 *
 * @param pack      ซองที่จะเปิด
 * @param packCount จำนวนซองที่เปิดพร้อมกัน (ได้การ์ด packCount × cardCount ใบ)
 */
export const openPack = (pack: CardPack, packCount = 1): PackOpenResult => {
  const openedDate = new Date();
  const openedAt = openedDate.toISOString();
  const available = getPackPlayers(pack);
  // กันกรณีตั้งค่าซองผิดจนไม่มีนักเตะเลย — ยังเปิดได้ ไม่ให้เกมค้าง
  const fallbackPool = available.length > 0 ? available : PLAYERS.filter((player) => !isPlayerLocked(player.id));

  /*
   * ซื้อทีละหลายซอง = สุ่มทีละใบเหมือนเปิดทีละซองทุกประการ
   * ไม่มีการรับประกันของดีหรือปรับโอกาสให้ต่างจากการเปิดทีละซอง
   * โอกาสของผู้เล่นจึงเท่ากันไม่ว่าจะซื้อแบบไหน
   */
  const opened = Math.max(1, Math.round(packCount));
  const total = opened * pack.cardCount;

  const cards: PlayerCardData[] = Array.from({ length: total }, () => {
    const rarity = rollRarity(pack);
    const pool = available.filter((player) => player.rarity === rarity);
    const player = pickRandom(pool.length > 0 ? pool : fallbackPool);

    /*
     * ใช้ createCardInstance แทนการประกอบอ็อบเจกต์เอง เพราะการแปลง
     * "ค่าตีบวก" เป็น "level" ที่เก็บจริงมีสูตรของมันอยู่ (levelForUpgrade)
     * ถ้าเขียน level: 1 ตรง ๆ ค่าบวกที่สุ่มได้จะหายไปเงียบ ๆ
     */
    return createCardInstance({
      playerId: player.id,
      upgrade: rollPackUpgrade(pack),
      // ทุกใบในการเปิดครั้งเดียวกันใช้เวลาเดียวกัน จะได้เรียงลำดับในคลังได้ตรง
      now: openedDate,
    });
  });

  return { packId: pack.id, cards, openedAt, packCount: opened };
};
