/**
 * แบนเนอร์อันดับ 1 — รูปพื้นหลังของแถวแชมป์ในตารางอันดับ
 *
 * ⚠️ กติกาข้อเดียวที่ห้ามละเมิด: ข้อมูลในตารางต้องอ่านออกเสมอ
 * สไตล์จึงประกอบเป็นสองชั้นทุกครั้ง — ฝ้าดำทับบนรูป (overlay) แล้วค่อยเป็นตัวรูป
 * และไล่ให้ทึบขึ้นทางซ้ายซึ่งเป็นฝั่งที่มีเลขอันดับกับชื่อทีม ส่วนขวาที่โล่งกว่าปล่อยให้รูปเด่นได้
 *
 * ทั้งตารางเต็ม วิดเจ็ตหน้าแรก และหน้าตัวอย่างในแอดมิน เรียก getChampionRowStyle ตัวเดียวกัน
 * ที่ทำแบบนี้เพราะถ้าแยกกันเขียน สิ่งที่แอดมินเห็นตอนปรับจะไม่ใช่สิ่งที่ผู้เล่นเห็นจริง
 *
 * เป็น pure function ล้วน ห้าม import React (นำเข้าเฉพาะชนิดข้อมูลได้ เพราะถูกลบตอนคอมไพล์)
 */
import type { CSSProperties } from 'react';
import { isSafeLuckyImage } from '@/services/luckyImage';
import type { ChampionBannerConfig } from '@/types/championBanner';
import { clamp } from '@/utils/helpers';

/** รูปที่ให้มาในโปรเจกต์ วางไว้ที่ public/leaderboard/ จึงไม่กินพื้นที่เอกสารค่าตั้ง */
export const CHAMPION_BANNER_IMAGE = '/leaderboard/champion-banner.webp';

/** ขอบเขตที่ยอมให้แอดมินปรับ — ต่ำกว่า OVERLAY_MIN เมื่อไหร่ตัวหนังสือเริ่มจม */
export const CHAMPION_BANNER_LIMITS = {
  overlay: { min: 0.25, max: 0.95 },
  focusY: { min: 0, max: 100 },
} as const;

export const DEFAULT_CHAMPION_BANNER: ChampionBannerConfig = {
  enabled: true,
  image: CHAMPION_BANNER_IMAGE,
  // 0.58 คือค่าที่ทดลองแล้วว่าเห็นรูปชัดแต่ตัวเลขดาวสีทองยังตัดกับพื้นหลังได้
  overlay: 0.58,
  // รูปต้นฉบับมีถ้วยอยู่กลางค่อนบน — 45% จับช่วงนั้นพอดีเมื่อแถวสูงราว 60px
  focusY: 45,
};

const num = (value: unknown, fallback: number, min: number, max: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? clamp(parsed, min, max) : fallback;
};

/** บีบค่าจากเซิร์ฟเวอร์ให้ใช้งานได้จริง — รูปที่ไม่ผ่านการตรวจถูกทิ้ง ไม่เอาไปใส่ src */
export const normalizeChampionBanner = (
  raw: Partial<ChampionBannerConfig> | null | undefined,
): ChampionBannerConfig => ({
  enabled: raw?.enabled !== false,
  image: isSafeLuckyImage(raw?.image) ? raw.image : DEFAULT_CHAMPION_BANNER.image,
  overlay: num(
    raw?.overlay,
    DEFAULT_CHAMPION_BANNER.overlay,
    CHAMPION_BANNER_LIMITS.overlay.min,
    CHAMPION_BANNER_LIMITS.overlay.max,
  ),
  focusY: Math.round(
    num(
      raw?.focusY,
      DEFAULT_CHAMPION_BANNER.focusY,
      CHAMPION_BANNER_LIMITS.focusY.min,
      CHAMPION_BANNER_LIMITS.focusY.max,
    ),
  ),
});

/** ตอนนี้ควรวาดแบนเนอร์ไหม (เปิดอยู่ + มีรูปที่ใช้ได้) */
export const isChampionBannerActive = (config: ChampionBannerConfig): boolean =>
  config.enabled && isSafeLuckyImage(config.image);

/**
 * สไตล์ของแถวอันดับ 1
 * คืน undefined เมื่อไม่ควรวาด — ผู้เรียกจะได้ถอยไปใช้แถบทองแบบเดิมได้ทันที
 *
 * ค่า overlay ที่แอดมินตั้งคือความมืด "ตรงกลางแถว" ส่วนซ้าย/ขวาบวกลบจากค่านั้น
 * ปรับตัวเดียวจึงคุมความอ่านง่ายได้ทั้งแถบ ไม่ต้องมานั่งตั้งทีละฝั่ง
 */
export const getChampionRowStyle = (
  config: ChampionBannerConfig,
): CSSProperties | undefined => {
  if (!isChampionBannerActive(config)) return undefined;

  const mid = config.overlay;
  const left = clamp(mid + 0.16, 0, 1);
  const right = clamp(mid - 0.14, 0, 1);
  const url = config.image.replace(/"/g, '%22');

  return {
    backgroundImage: [
      `linear-gradient(90deg, rgba(8,11,16,${left}) 0%, rgba(8,11,16,${mid}) 50%, rgba(8,11,16,${right}) 100%)`,
      `url("${url}")`,
    ].join(', '),
    backgroundSize: 'cover',
    backgroundPosition: `center ${config.focusY}%`,
    backgroundRepeat: 'no-repeat',
    // เงาใต้ตัวอักษรสืบทอดลงไปทุกช่องในแถว ทำให้ข้อความไม่จมแม้ตกไปตรงจุดที่รูปสว่าง
    textShadow: '0 1px 3px rgba(0,0,0,0.9)',
  };
};
