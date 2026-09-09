/**
 * ADMIN → ผสมการ์ด
 *
 * ปรับได้: เปิด/ปิดระบบ (ปิดแล้วเมนู Fusion หายจากทุกเครื่อง) · จำนวนการ์ดที่ใช้ผสม ·
 * จำนวนการ์ดคว่ำที่โชว์ · ตารางน้ำหนักการสุ่มทั้ง 9 แถว · เงื่อนไขและช่วงเงินโบนัส
 *
 * ตารางเป็น "น้ำหนัก" ไม่ใช่เปอร์เซ็นต์ — ไม่ต้องนั่งบวกให้ครบ 100
 * ระบบคิดสัดส่วนให้เอง และคอลัมน์ขวาโชว์เปอร์เซ็นต์จริงที่ผู้เล่นจะเห็นแบบสด ๆ
 *
 * ⚠️ แถวคือ "ค่าบวกต่ำสุดของวัสดุ" ไม่ใช่ค่าเฉลี่ย — ผสม +8, +8, +2 จะใช้แถว 2
 * ตั้งใจให้เป็นแบบนี้ เพื่อกันการเอาใบขยะไปถ่วงกับใบเทพแล้วยังได้โอกาสของใบเทพ
 */
import { useEffect, useMemo, useState } from 'react';
import { MAX_UPGRADE } from '@/data/upgradeConfig';
import { useGameConfig } from '@/hooks/useGameConfig';
import {
  DEFAULT_FUSION,
  FUSION_LIMITS,
  FUSION_MIN_PLUS,
  FUSION_ODDS_COLUMNS,
  getFusionOdds,
  normalizeFusion,
} from '@/services/fusion';
import { playSfx } from '@/services/sound';
import type { FusionConfig } from '@/types/fusion';
import { cn, formatNumber } from '@/utils/helpers';

const NumberField = ({
  label,
  hint,
  value,
  step = 1,
  min = 0,
  max,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  step?: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}) => (
  <label className="block">
    <span className="block font-mono text-[10px] uppercase tracking-wide text-chalk/45">
      {label}
    </span>
    <input
      type="number"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(event) => onChange(Number(event.target.value) || 0)}
      className="mt-1 w-full rounded-lg bg-white/5 px-3 py-2 font-mono text-xs outline-none focus:bg-white/10"
    />
    {hint && <span className="mt-1 block text-[10px] text-chalk/35">{hint}</span>}
  </label>
);

/** หัวคอลัมน์ของตาราง = ผลลัพธ์ +1 … +8 */
const RESULT_COLUMNS = Array.from(
  { length: FUSION_ODDS_COLUMNS },
  (_, index) => FUSION_MIN_PLUS + index,
);

/** แถวของตาราง = ค่าบวกต่ำสุดของวัสดุ +0 … +8 */
const MATERIAL_ROWS = Array.from({ length: MAX_UPGRADE + 1 }, (_, index) => index);

export const FusionPanel = () => {
  const { fusion, saveFusion } = useGameConfig();
  const [draft, setDraft] = useState<FusionConfig>(fusion);
  const [status, setStatus] = useState('');
  /** แถวที่กางออกดูเปอร์เซ็นต์จริง — ค่าเริ่มต้นคือแถวที่คนสนใจที่สุด (+8 ครบทุกใบ) */
  const [preview, setPreview] = useState(MAX_UPGRADE);

  // ค่าจากเซิร์ฟเวอร์มาทีหลัง (onSnapshot) จึงต้องซิงก์ลงช่องแก้ไขเมื่อมันเปลี่ยน
  useEffect(() => setDraft(fusion), [fusion]);

  const clean = useMemo(() => normalizeFusion(draft), [draft]);
  const previewOdds = useMemo(() => getFusionOdds(preview, clean), [clean, preview]);

  /** แก้ตัวเลขหนึ่งช่องในตาราง (แถว = วัสดุ, คอลัมน์ = ผลลัพธ์) */
  const setWeight = (materialPlus: number, column: number, value: number) => {
    setDraft((prev) => {
      const key = String(materialPlus);
      const row = [...(prev.odds[key] ?? DEFAULT_FUSION.odds[key])];
      row[column] = Math.max(0, value);
      return { ...prev, odds: { ...prev.odds, [key]: row } };
    });
  };

  const save = async () => {
    playSfx('click');
    setStatus('กำลังบันทึก…');
    const error = await saveFusion(clean);
    setStatus(error ?? 'บันทึกแล้ว — ผู้เล่นเห็นค่าใหม่ทันที');
  };

  return (
    <section className="glass-panel space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="panel-title">ผสมการ์ด</p>
          <p className="mt-1 text-xs text-chalk/45">
            ผู้เล่นเอาการ์ดระดับเดียวกันมาผสม → ได้การ์ดระดับเดิม 1 ใบ ค่าตีบวกสุ่ม +1 ถึง +8
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

      <div className="grid gap-3 sm:grid-cols-2">
        <NumberField
          label="ใช้การ์ดกี่ใบต่อการผสม"
          hint={`${FUSION_LIMITS.materials.min}–${FUSION_LIMITS.materials.max} ใบ · ต้องระดับเดียวกันทุกใบ`}
          min={FUSION_LIMITS.materials.min}
          max={FUSION_LIMITS.materials.max}
          value={draft.materials}
          onChange={(value) => setDraft((prev) => ({ ...prev, materials: value }))}
        />
        <NumberField
          label="โชว์การ์ดคว่ำกี่ใบ"
          hint={`${FUSION_LIMITS.candidates.min}–${FUSION_LIMITS.candidates.max} ใบ · ใบแรกที่ผู้เล่นเปิดคือใบที่ได้จริง`}
          min={FUSION_LIMITS.candidates.min}
          max={FUSION_LIMITS.candidates.max}
          value={draft.candidates}
          onChange={(value) => setDraft((prev) => ({ ...prev, candidates: value }))}
        />
      </div>

      {/* ── ตารางน้ำหนักการสุ่ม ─────────────────────────────── */}
      <div className="rounded-xl border border-white/10 bg-black/25 p-4">
        <p className="panel-title">ตารางโอกาส</p>
        <p className="mt-1 text-[11px] text-chalk/40">
          แถว = ค่าบวก <span className="text-chalk/70">ต่ำสุด</span> ของวัสดุ · คอลัมน์ = ค่าบวกของผลลัพธ์ ·
          ตัวเลขเป็นน้ำหนัก ไม่ต้องรวมให้ครบ 100
        </p>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] border-separate border-spacing-1">
            <thead>
              <tr>
                <th className="w-16 text-left font-mono text-[10px] uppercase text-chalk/35">
                  วัสดุ
                </th>
                {RESULT_COLUMNS.map((plus) => (
                  <th
                    key={plus}
                    className={cn(
                      'font-mono text-[10px] uppercase',
                      plus >= 7 ? 'text-gold' : 'text-chalk/35',
                    )}
                  >
                    +{plus}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MATERIAL_ROWS.map((materialPlus) => {
                const row = draft.odds[String(materialPlus)] ?? DEFAULT_FUSION.odds[String(materialPlus)];
                const total = row.reduce((sum, weight) => sum + (Number(weight) || 0), 0);

                return (
                  <tr key={materialPlus}>
                    <th
                      className={cn(
                        'cursor-pointer text-left font-mono text-[11px]',
                        preview === materialPlus ? 'text-neon' : 'text-chalk/55',
                      )}
                      onClick={() => setPreview(materialPlus)}
                      title="กดเพื่อดูเปอร์เซ็นต์จริงของแถวนี้"
                    >
                      +{materialPlus}
                      <span className="ml-1 text-[9px] text-chalk/25">({total})</span>
                    </th>
                    {RESULT_COLUMNS.map((plus, column) => (
                      <td key={plus}>
                        <input
                          type="number"
                          min={0}
                          step={0.1}
                          value={row[column] ?? 0}
                          onChange={(event) =>
                            setWeight(materialPlus, column, Number(event.target.value) || 0)
                          }
                          className="w-full rounded bg-white/5 px-1.5 py-1 text-center font-mono text-[11px] outline-none focus:bg-white/10"
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* เปอร์เซ็นต์จริงของแถวที่เลือก — เห็นผลก่อนกดบันทึก */}
        <div className="mt-3 rounded-lg border border-white/10 bg-black/30 p-3">
          <p className="font-mono text-[10px] uppercase tracking-wide text-chalk/40">
            โอกาสจริงเมื่อวัสดุต่ำสุดคือ +{preview}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {previewOdds.map(({ plus, chance }) => (
              <span
                key={plus}
                className={cn('font-mono text-[11px]', plus >= 7 ? 'text-gold' : 'text-chalk/55')}
              >
                +{plus} <span className="text-chalk/35">{chance.toFixed(2)}%</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── เงินโบนัส ───────────────────────────────────────── */}
      <div className="rounded-xl border border-white/10 bg-black/25 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="panel-title">เงินโบนัส</p>
            <p className="mt-1 text-[11px] text-chalk/40">
              แถมเงินเมื่อวัสดุ <span className="text-chalk/70">ทุกใบ</span> บวกถึงเกณฑ์ ·
              สุ่มแยกของการ์ดคว่ำแต่ละใบ
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              playSfx('click');
              setDraft((prev) => ({ ...prev, cashEnabled: !prev.cashEnabled }));
            }}
            className={cn(
              'rounded-lg px-4 py-2 text-xs font-bold uppercase transition-colors',
              draft.cashEnabled ? 'bg-gold text-ink-900' : 'bg-white/5 text-chalk/50',
            )}
          >
            {draft.cashEnabled ? 'เปิดอยู่' : 'ปิดอยู่'}
          </button>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <NumberField
            label="ต้องบวกอย่างน้อย"
            hint={`0–${MAX_UPGRADE} · นับทุกใบที่ใช้ผสม`}
            min={0}
            max={MAX_UPGRADE}
            value={draft.cashMinPlus}
            onChange={(value) => setDraft((prev) => ({ ...prev, cashMinPlus: value }))}
          />
          <NumberField
            label="โอกาสได้ (0–1)"
            hint={`ตอนนี้ = ${Math.round(clean.cashChance * 100)}%`}
            step={0.05}
            min={0}
            max={1}
            value={draft.cashChance}
            onChange={(value) => setDraft((prev) => ({ ...prev, cashChance: value }))}
          />
          <NumberField
            label="เงินต่ำสุด"
            step={100_000}
            value={draft.cashMin}
            onChange={(value) => setDraft((prev) => ({ ...prev, cashMin: value }))}
          />
          <NumberField
            label="เงินสูงสุด"
            hint={`ปัดเป็นขั้นละ ${formatNumber(clean.cashStep)}`}
            step={100_000}
            value={draft.cashMax}
            onChange={(value) => setDraft((prev) => ({ ...prev, cashMax: value }))}
          />
        </div>

        <div className="mt-3 sm:max-w-[240px]">
          <NumberField
            label="ปัดเป็นขั้นละ"
            hint="1 = ได้เลขเศษทุกจำนวน · 100000 = ลงท้ายแสนเสมอ"
            step={10_000}
            min={1}
            value={draft.cashStep}
            onChange={(value) => setDraft((prev) => ({ ...prev, cashStep: value }))}
          />
        </div>

        <p className="mt-3 text-[11px] text-chalk/40">
          สรุปที่ผู้เล่นจะเห็น:{' '}
          {clean.cashEnabled
            ? `ใช้การ์ด +${clean.cashMinPlus} ขึ้นไปครบ ${clean.materials} ใบ → โอกาส ${Math.round(clean.cashChance * 100)}% ได้ ${formatNumber(clean.cashMin)}–${formatNumber(clean.cashMax)} ฿`
            : 'ปิดโบนัสเงินไว้'}
        </p>
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
            setDraft(DEFAULT_FUSION);
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
