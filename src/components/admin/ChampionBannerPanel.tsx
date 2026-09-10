/**
 * ADMIN → แบนเนอร์อันดับ 1
 *
 * ตั้งรูปพื้นหลังของแถวอันดับ 1 ในตารางอันดับ พร้อมตัวคุมความมืดและตำแหน่งรูป
 *
 * ตัวอย่างด้านล่างเรียก getChampionRowStyle ตัวเดียวกับตารางจริง สิ่งที่เห็นตรงนี้
 * จึงเป็นสิ่งที่ผู้เล่นเห็นเป๊ะ ๆ — ปรับแถบความมืดแล้วดูว่าเลข 1 ชื่อทีม และดาว
 * ยังอ่านออกไหม ก่อนกดบันทึก
 */
import { useEffect, useMemo, useState } from 'react';
import { ImagePicker } from '@/components/admin/ImagePicker';
import { useGameConfig } from '@/hooks/useGameConfig';
import {
  CHAMPION_BANNER_IMAGE,
  CHAMPION_BANNER_LIMITS,
  DEFAULT_CHAMPION_BANNER,
  getChampionRowStyle,
  isChampionBannerActive,
  normalizeChampionBanner,
} from '@/services/championBanner';
import { playSfx } from '@/services/sound';
import type { ChampionBannerConfig } from '@/types/championBanner';
import { cn } from '@/utils/helpers';

/** แถวปลอมไว้ดูตัวอย่าง — ตัวเลขไม่ต้องจริง ขอแค่ครบทุกคอลัมน์ที่ต้องอ่านออก */
const SAMPLE = {
  rank: 1,
  teamName: 'ทีมตัวอย่าง ยูไนเต็ด',
  managerName: 'ผู้จัดการทีม',
  ovr: 92,
  record: '18/3/1',
  points: 1240,
};

const Slider = ({
  label,
  hint,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
}) => (
  <label className="block">
    <span className="flex items-baseline justify-between">
      <span className="font-mono text-[10px] uppercase tracking-wide text-chalk/45">{label}</span>
      <span className="font-mono text-[11px] text-neon">{format(value)}</span>
    </span>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className="mt-2 w-full accent-neon"
    />
    {hint && <span className="mt-1 block text-[10px] text-chalk/35">{hint}</span>}
  </label>
);

export const ChampionBannerPanel = () => {
  const { championBanner, saveChampionBanner } = useGameConfig();
  const [draft, setDraft] = useState<ChampionBannerConfig>(championBanner);
  const [status, setStatus] = useState('');

  // ค่าจากเซิร์ฟเวอร์มาทีหลัง (onSnapshot) จึงต้องซิงก์ลงหน้าจอเมื่อมันเปลี่ยน
  useEffect(() => setDraft(championBanner), [championBanner]);

  const clean = useMemo(() => normalizeChampionBanner(draft), [draft]);
  const previewStyle = getChampionRowStyle(clean);
  const active = isChampionBannerActive(clean);

  const save = async () => {
    playSfx('click');
    setStatus('กำลังบันทึก…');
    const error = await saveChampionBanner(clean);
    setStatus(error ?? 'บันทึกแล้ว — ผู้เล่นเห็นแบนเนอร์ใหม่ทันที');
  };

  return (
    <section className="glass-panel space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="panel-title">แบนเนอร์อันดับ 1</p>
          <p className="mt-1 text-xs text-chalk/45">
            รูปพื้นหลังของแถวอันดับ 1 ในตารางอันดับ · ปิดเมื่อไหร่จะกลับไปใช้แถบไล่สีทองแบบเดิม
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            playSfx('click');
            setDraft((prev) => ({ ...prev, enabled: !prev.enabled }));
          }}
          className={cn(
            'rounded-lg px-4 py-2 text-xs font-bold uppercase transition-colors',
            draft.enabled ? 'bg-neon text-ink-900' : 'bg-white/5 text-chalk/50',
          )}
        >
          {draft.enabled ? 'เปิดอยู่' : 'ปิดอยู่'}
        </button>
      </div>

      {/* ── ตัวอย่างแถวจริง ─────────────────────────────────── */}
      <div>
        <p className="mb-2 font-mono text-[10px] uppercase tracking-wide text-chalk/45">
          ตัวอย่าง (เหมือนที่ผู้เล่นเห็น)
        </p>

        <div className="overflow-hidden rounded-lg border border-white/10 bg-ink-900/60">
          <div
            style={previewStyle}
            className={cn(
              'flex items-center gap-3 px-4 py-3 text-sm',
              active
                ? 'ring-1 ring-inset ring-gold/40'
                : 'bg-gradient-to-r from-gold/15 via-gold/5 to-transparent',
            )}
          >
            <span className="font-display text-lg text-gold">{SAMPLE.rank}</span>

            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{SAMPLE.teamName}</span>
              <span className="block truncate text-xs text-chalk/60">{SAMPLE.managerName}</span>
            </span>

            <span className="hidden font-mono sm:inline">{SAMPLE.ovr}</span>
            <span className="hidden font-mono text-chalk/70 md:inline">{SAMPLE.record}</span>
            <span className="whitespace-nowrap font-display text-lg text-gold">
              ⭐ {SAMPLE.points}
            </span>
          </div>

          {/* แถวอันดับ 2 ไว้เทียบว่าแบนเนอร์เด่นเกินจนกลืนแถวอื่นหรือยัง */}
          <div className="flex items-center gap-3 border-t border-white/5 px-4 py-3 text-sm">
            <span className="font-display text-lg text-chalk/80">2</span>
            <span className="min-w-0 flex-1 truncate font-semibold text-chalk/80">
              แถวปกติไว้เทียบ
            </span>
            <span className="whitespace-nowrap font-display text-lg text-gold">⭐ 1180</span>
          </div>
        </div>

        {!active && draft.enabled && (
          <p className="mt-2 text-[11px] text-gold">
            รูปที่ใส่ยังใช้ไม่ได้ — ตอนนี้ผู้เล่นเห็นแถบทองแบบเดิม
          </p>
        )}
      </div>

      <ImagePicker
        label="รูปแบนเนอร์"
        value={draft.image}
        onChange={(image) => setDraft((prev) => ({ ...prev, image }))}
        onError={setStatus}
      />

      <p className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-[11px] text-chalk/45">
        แบนเนอร์เป็นรูปแนวนอนใหญ่ ควรวางไฟล์ไว้ที่ <code>public/leaderboard/</code> แล้วใส่พาธ
        (เช่น <code>{CHAMPION_BANNER_IMAGE}</code>) มากกว่าอัปโหลดฝังในค่าตั้ง — เอกสารค่าตั้งนี้
        ผู้เล่นทุกคนต้องโหลด และการอัปโหลดจะย่อรูปเหลือด้านยาว 128px ซึ่งเล็กเกินไปสำหรับแบนเนอร์
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Slider
          label="ความมืดของฝ้า"
          hint="ยิ่งมากยิ่งอ่านข้อมูลง่าย แต่รูปจะจางลง"
          min={CHAMPION_BANNER_LIMITS.overlay.min}
          max={CHAMPION_BANNER_LIMITS.overlay.max}
          step={0.01}
          value={draft.overlay}
          format={(value) => `${Math.round(value * 100)}%`}
          onChange={(overlay) => setDraft((prev) => ({ ...prev, overlay }))}
        />
        <Slider
          label="ตำแหน่งรูปแนวตั้ง"
          hint="แถวเตี้ยกว่ารูปมาก เลื่อนเพื่อเลือกว่าจะโชว์ช่วงไหนของรูป"
          min={CHAMPION_BANNER_LIMITS.focusY.min}
          max={CHAMPION_BANNER_LIMITS.focusY.max}
          step={1}
          value={draft.focusY}
          format={(value) => `${value}%`}
          onChange={(focusY) => setDraft((prev) => ({ ...prev, focusY }))}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={save}
          className="rounded-lg bg-neon px-4 py-2 text-xs font-bold uppercase text-ink-900"
        >
          บันทึก
        </button>
        <button
          type="button"
          onClick={() => {
            playSfx('click');
            setDraft(DEFAULT_CHAMPION_BANNER);
            setStatus('คืนค่าเริ่มต้นแล้ว — ยังไม่ได้บันทึก');
          }}
          className="rounded-lg bg-white/5 px-4 py-2 text-xs uppercase text-chalk/60 hover:bg-white/10"
        >
          คืนค่าเริ่มต้น
        </button>
        {status && <p className="text-xs text-chalk/55">{status}</p>}
      </div>
    </section>
  );
};
