/**
 * เทสแบนเนอร์อันดับ 1
 *
 * ข้อกำหนดที่ต้องล็อกไว้: "ภาพต้องไม่เข้มจนมองข้อมูลอันดับไม่เห็น"
 * แปลเป็นเงื่อนไขที่เทสได้คือ ต้องมีชั้นฝ้าคลุมรูปเสมอ และค่าฝ้าต้องไม่ต่ำกว่าขั้นต่ำ
 * ไม่ว่าแอดมินจะตั้งอะไรมา (หรือมีใครไปแก้เอกสารใน Firestore ตรง ๆ)
 */
import { describe, expect, it } from 'vitest';
import {
  CHAMPION_BANNER_IMAGE,
  CHAMPION_BANNER_LIMITS,
  DEFAULT_CHAMPION_BANNER,
  getChampionRowStyle,
  isChampionBannerActive,
  normalizeChampionBanner,
} from '@/services/championBanner';

describe('ค่าตั้งแบนเนอร์', () => {
  it('ยังไม่เคยตั้ง = ใช้รูปที่ให้มาในโปรเจกต์ และเปิดอยู่', () => {
    const clean = normalizeChampionBanner(null);
    expect(clean.enabled).toBe(true);
    expect(clean.image).toBe(CHAMPION_BANNER_IMAGE);
    expect(clean).toEqual(DEFAULT_CHAMPION_BANNER);
  });

  it('รูปที่ไม่ปลอดภัยถูกทิ้ง ถอยไปใช้รูปเริ่มต้น', () => {
    expect(normalizeChampionBanner({ image: 'javascript:alert(1)' }).image).toBe(
      CHAMPION_BANNER_IMAGE,
    );
    expect(normalizeChampionBanner({ image: '/leaderboard/other.webp' }).image).toBe(
      '/leaderboard/other.webp',
    );
  });

  it('ฝ้าถูกบีบให้อยู่ในช่วงที่ยังอ่านข้อมูลออก', () => {
    // ตั้งใจตั้งให้ใสสนิท — ต้องถูกดันขึ้นมาที่ขั้นต่ำ ไม่ใช่ปล่อยผ่าน
    expect(normalizeChampionBanner({ overlay: 0 }).overlay).toBe(
      CHAMPION_BANNER_LIMITS.overlay.min,
    );
    expect(normalizeChampionBanner({ overlay: 5 }).overlay).toBe(
      CHAMPION_BANNER_LIMITS.overlay.max,
    );
  });

  it('ตำแหน่งรูปถูกบีบเป็นจำนวนเต็ม 0–100', () => {
    expect(normalizeChampionBanner({ focusY: -40 }).focusY).toBe(0);
    expect(normalizeChampionBanner({ focusY: 260 }).focusY).toBe(100);
    expect(normalizeChampionBanner({ focusY: 42.6 }).focusY).toBe(43);
  });
});

describe('สไตล์ของแถวแชมป์', () => {
  it('ปิดอยู่ = ไม่คืนสไตล์ ให้ถอยไปใช้แถบทองแบบเดิม', () => {
    const off = normalizeChampionBanner({ enabled: false });
    expect(isChampionBannerActive(off)).toBe(false);
    expect(getChampionRowStyle(off)).toBeUndefined();
  });

  it('มีชั้นฝ้าคลุมทับรูปเสมอ ไม่ใช่รูปเปล่า ๆ', () => {
    const style = getChampionRowStyle(DEFAULT_CHAMPION_BANNER);
    const layers = String(style?.backgroundImage);

    expect(layers).toContain('linear-gradient');
    expect(layers).toContain(CHAMPION_BANNER_IMAGE);
    // ฝ้าต้องมาก่อน url ใน CSS ไม่งั้นมันจะไปอยู่ใต้รูปแล้วไม่ช่วยอะไร
    expect(layers.indexOf('linear-gradient')).toBeLessThan(layers.indexOf('url('));
  });

  it('ตัวหนังสือมีเงารองเสมอ กันข้อความจมตรงจุดที่รูปสว่าง', () => {
    expect(getChampionRowStyle(DEFAULT_CHAMPION_BANNER)?.textShadow).toBeTruthy();
  });

  it('ตำแหน่งแนวตั้งที่แอดมินตั้งมีผลจริง', () => {
    const style = getChampionRowStyle(normalizeChampionBanner({ focusY: 80 }));
    expect(style?.backgroundPosition).toBe('center 80%');
  });

  it('ฝั่งซ้ายทึบกว่าฝั่งขวาเสมอ (ฝั่งซ้ายคือเลขอันดับกับชื่อทีม)', () => {
    const layers = String(getChampionRowStyle(DEFAULT_CHAMPION_BANNER)?.backgroundImage);
    const alphas = [...layers.matchAll(/rgba\(8,11,16,([\d.]+)\)/g)].map((match) =>
      Number(match[1]),
    );

    expect(alphas).toHaveLength(3);
    expect(alphas[0]).toBeGreaterThan(alphas[1]);
    expect(alphas[1]).toBeGreaterThan(alphas[2]);
  });
});
