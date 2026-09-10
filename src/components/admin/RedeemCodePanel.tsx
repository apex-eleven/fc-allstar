/**
 * ADMIN → โค้ดรับของ
 *
 * สร้าง แก้ ปิด และลบโค้ด พร้อมดูว่าถูกใช้ไปแล้วกี่ครั้ง
 *
 * ⚠️ โค้ดไม่ได้อยู่ใน config/{doc} เหมือนแผงอื่น แต่อยู่ที่คอลเลกชัน redeemCodes/
 * เพราะจำนวนโค้ดโตได้เรื่อย ๆ ถ้ายัดรวมเอกสารเดียว ผู้เล่นทุกคนจะต้องโหลด
 * โค้ดทั้งหมดที่เคยสร้างมาตลอดกาล และเอกสารจะชนเพดาน 1 MB เข้าสักวัน
 * แยกเป็นเอกสารละโค้ดแล้วผู้เล่นอ่านเฉพาะใบที่ตัวเองพิมพ์
 */
import { useEffect, useMemo, useState } from 'react';
import { RewardEditor } from '@/components/admin/RewardEditor';
import { RewardChip } from '@/components/rewards/RewardChip';
import { useAuth } from '@/hooks/useAuth';
import {
  deleteRedeemCode,
  saveRedeemCode,
  watchRedeemCodes,
} from '@/services/firebase/redeemCodes';
import {
  describeCodeStatus,
  emptyCode,
  generateCode,
  isCodeShapeValid,
  normalizeCode,
  REDEEM_CODE_MAX,
  REDEEM_MAX_REWARDS,
} from '@/services/redeemCode';
import { playSfx } from '@/services/sound';
import type { RedeemCodeDoc } from '@/types/redeem';
import { cn } from '@/utils/helpers';

/** แปลง ms → ค่าที่ใส่ใน <input type="datetime-local"> ได้ (เวลาท้องถิ่น) */
const toLocalInput = (ms: number): string => {
  if (!ms) return '';
  const date = new Date(ms - new Date().getTimezoneOffset() * 60_000);
  return date.toISOString().slice(0, 16);
};

const STATUS_TONE = {
  live: 'bg-neon/15 text-neon',
  off: 'bg-white/5 text-chalk/45',
  done: 'bg-gem/15 text-gem',
} as const;

export const RedeemCodePanel = () => {
  const { account } = useAuth();
  const [codes, setCodes] = useState<RedeemCodeDoc[]>([]);
  const [draft, setDraft] = useState<RedeemCodeDoc | null>(null);
  const [status, setStatus] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => watchRedeemCodes(setCodes), []);

  const now = Date.now();
  /** โค้ดที่ยังใช้ได้ตอนนี้ ไว้โชว์เป็นตัวเลขสรุปด้านบน */
  const liveCount = useMemo(
    () => codes.filter((code) => describeCodeStatus(code, now).tone === 'live').length,
    [codes, now],
  );

  const startNew = () => {
    playSfx('click');
    setDraft(emptyCode(generateCode(), account?.username ?? 'admin'));
    setStatus('');
  };

  const patch = (next: Partial<RedeemCodeDoc>) =>
    setDraft((prev) => (prev ? { ...prev, ...next } : prev));

  const save = async () => {
    if (!draft) return;

    const code = normalizeCode(draft.code);
    if (!isCodeShapeValid(code)) {
      setStatus('โค้ดต้องยาว 4–24 ตัว ใช้ได้เฉพาะ A-Z, 0-9 และขีดกลาง');
      playSfx('error');
      return;
    }
    if (draft.rewards.length === 0) {
      setStatus('ใส่ของรางวัลอย่างน้อยหนึ่งชิ้น');
      playSfx('error');
      return;
    }

    playSfx('click');
    setStatus('กำลังบันทึก…');
    try {
      await saveRedeemCode({ ...draft, code });
      setStatus(`บันทึกโค้ด ${code} แล้ว — ผู้เล่นใช้ได้ทันที`);
      setDraft(null);
    } catch (error) {
      console.error('[redeem] บันทึกโค้ดไม่สำเร็จ', error);
      setStatus('บันทึกไม่สำเร็จ — ตรวจว่าล็อกอินด้วยบัญชีเจ้าของโปรเจคอยู่ไหม');
    }
  };

  const remove = async (code: string) => {
    playSfx('click');
    setStatus('กำลังลบ…');
    try {
      await deleteRedeemCode(code);
      setStatus(`ลบโค้ด ${code} แล้ว`);
      setConfirmDelete(null);
    } catch (error) {
      console.error('[redeem] ลบโค้ดไม่สำเร็จ', error);
      setStatus('ลบไม่สำเร็จ');
    }
  };

  return (
    <section className="glass-panel space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="panel-title">โค้ดรับของ</p>
          <p className="mt-1 text-xs text-chalk/45">
            สร้างโค้ดแจกผู้เล่น · หนึ่งโค้ดรับได้คนละครั้งเดียว · ผู้เล่นกรอกที่เมนู Redeem Code
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="font-display text-2xl text-neon">{liveCount}</p>
            <p className="font-mono text-[10px] uppercase text-chalk/35">โค้ดที่ใช้ได้</p>
          </div>
          <button
            type="button"
            onClick={startNew}
            className="rounded-lg bg-neon px-4 py-2 text-xs font-bold uppercase text-ink-900"
          >
            + สร้างโค้ด
          </button>
        </div>
      </div>

      {status && <p className="text-xs text-chalk/55">{status}</p>}

      {/* ── ตัวแก้โค้ด ──────────────────────────────────────── */}
      {draft && (
        <div className="space-y-3 rounded-xl border border-neon/30 bg-black/30 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="block font-mono text-[10px] uppercase tracking-wide text-chalk/45">
                ตัวโค้ด
              </span>
              <div className="mt-1 flex gap-2">
                <input
                  value={draft.code}
                  maxLength={REDEEM_CODE_MAX}
                  onChange={(event) => patch({ code: normalizeCode(event.target.value) })}
                  className="w-full rounded-lg bg-white/5 px-3 py-2 font-mono text-sm tracking-widest outline-none focus:bg-white/10"
                />
                <button
                  type="button"
                  onClick={() => {
                    playSfx('click');
                    patch({ code: generateCode() });
                  }}
                  title="สุ่มโค้ดใหม่"
                  className="shrink-0 rounded-lg bg-white/5 px-3 text-xs uppercase text-chalk/60 hover:bg-white/10"
                >
                  สุ่ม
                </button>
              </div>
              <span className="mt-1 block text-[10px] text-chalk/35">
                ใช้โค้ดเดิมที่มีอยู่แล้ว = แก้ทับใบนั้น (คนที่รับไปแล้วยังรับซ้ำไม่ได้)
              </span>
            </label>

            <label className="block">
              <span className="block font-mono text-[10px] uppercase tracking-wide text-chalk/45">
                ข้อความตอนรับสำเร็จ
              </span>
              <input
                value={draft.note}
                maxLength={200}
                placeholder="เช่น ขอบคุณที่ติดตามเพจ!"
                onChange={(event) => patch({ note: event.target.value })}
                className="mt-1 w-full rounded-lg bg-white/5 px-3 py-2 text-xs outline-none focus:bg-white/10"
              />
            </label>

            <label className="block">
              <span className="block font-mono text-[10px] uppercase tracking-wide text-chalk/45">
                จำนวนครั้งที่รับได้ทั้งหมด
              </span>
              <input
                type="number"
                min={0}
                value={draft.maxUses}
                onChange={(event) => patch({ maxUses: Math.max(0, Number(event.target.value) || 0) })}
                className="mt-1 w-full rounded-lg bg-white/5 px-3 py-2 font-mono text-xs outline-none focus:bg-white/10"
              />
              <span className="mt-1 block text-[10px] text-chalk/35">
                0 = ไม่จำกัดจำนวนคน (แต่ละคนยังรับได้ครั้งเดียวอยู่ดี)
              </span>
            </label>

            <label className="block">
              <span className="block font-mono text-[10px] uppercase tracking-wide text-chalk/45">
                หมดอายุ
              </span>
              <input
                type="datetime-local"
                value={toLocalInput(draft.expiresAtMs)}
                onChange={(event) =>
                  patch({
                    expiresAtMs: event.target.value ? new Date(event.target.value).getTime() : 0,
                  })
                }
                className="mt-1 w-full rounded-lg bg-white/5 px-3 py-2 font-mono text-xs outline-none focus:bg-white/10"
              />
              <span className="mt-1 block text-[10px] text-chalk/35">เว้นว่าง = ไม่มีวันหมดอายุ</span>
            </label>
          </div>

          <button
            type="button"
            onClick={() => {
              playSfx('click');
              patch({ enabled: !draft.enabled });
            }}
            className={cn(
              'rounded-lg px-4 py-2 text-xs font-bold uppercase transition-colors',
              draft.enabled ? 'bg-neon text-ink-900' : 'bg-white/5 text-chalk/50',
            )}
          >
            {draft.enabled ? 'เปิดใช้งาน' : 'ปิดอยู่'}
          </button>

          {/* ── ของรางวัล ─────────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wide text-chalk/45">
                ของรางวัล ({draft.rewards.length}/{REDEEM_MAX_REWARDS})
              </span>
              <button
                type="button"
                disabled={draft.rewards.length >= REDEEM_MAX_REWARDS}
                onClick={() => {
                  playSfx('click');
                  patch({ rewards: [...draft.rewards, { kind: 'coins', amount: 10_000 }] });
                }}
                className="rounded bg-white/5 px-2.5 py-1 text-[10px] uppercase text-chalk/60 hover:bg-white/10 disabled:opacity-30"
              >
                + เพิ่มของ
              </button>
            </div>

            <div className="grid gap-2 lg:grid-cols-2">
              {draft.rewards.map((reward, index) => (
                <div key={index} className="space-y-1">
                  <RewardEditor
                    value={reward}
                    label={`ชิ้นที่ ${index + 1}`}
                    onChange={(next) =>
                      patch({
                        rewards: draft.rewards.map((entry, position) =>
                          position === index ? next : entry,
                        ),
                      })
                    }
                  />
                  <button
                    type="button"
                    onClick={() => {
                      playSfx('click');
                      patch({
                        rewards: draft.rewards.filter((_, position) => position !== index),
                      });
                    }}
                    className="text-[10px] uppercase text-gem/70 hover:text-gem"
                  >
                    เอาออก
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void save()}
              className="rounded-lg bg-neon px-4 py-2 text-xs font-bold uppercase text-ink-900"
            >
              บันทึกโค้ด
            </button>
            <button
              type="button"
              onClick={() => {
                playSfx('click');
                setDraft(null);
              }}
              className="rounded-lg bg-white/5 px-4 py-2 text-xs uppercase text-chalk/60 hover:bg-white/10"
            >
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      {/* ── รายการโค้ด ──────────────────────────────────────── */}
      {codes.length === 0 ? (
        <p className="py-8 text-center text-xs text-chalk/40">ยังไม่มีโค้ด กด "สร้างโค้ด" เพื่อเริ่ม</p>
      ) : (
        <div className="space-y-2">
          {codes.map((code) => {
            const state = describeCodeStatus(code, now);

            return (
              <div
                key={code.code}
                className="rounded-xl border border-white/10 bg-black/25 p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm tracking-widest text-chalk">{code.code}</span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] uppercase',
                      STATUS_TONE[state.tone],
                    )}
                  >
                    {state.label}
                  </span>

                  <span className="font-mono text-[11px] text-chalk/40">
                    ใช้ไป {code.uses}
                    {code.maxUses > 0 ? ` / ${code.maxUses}` : ' ครั้ง'}
                  </span>

                  {code.expiresAtMs > 0 && (
                    <span className="font-mono text-[11px] text-chalk/40">
                      ถึง {new Date(code.expiresAtMs).toLocaleString('th-TH')}
                    </span>
                  )}

                  <span className="ml-auto flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        playSfx('click');
                        void navigator.clipboard?.writeText(code.code);
                        setStatus(`ก๊อปโค้ด ${code.code} แล้ว`);
                      }}
                      className="rounded bg-white/5 px-2.5 py-1 text-[10px] uppercase text-chalk/60 hover:bg-white/10"
                    >
                      ก๊อป
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        playSfx('click');
                        setDraft(code);
                        setStatus('');
                      }}
                      className="rounded bg-white/5 px-2.5 py-1 text-[10px] uppercase text-chalk/60 hover:bg-white/10"
                    >
                      แก้
                    </button>
                    {confirmDelete === code.code ? (
                      <button
                        type="button"
                        onClick={() => void remove(code.code)}
                        className="rounded bg-gem px-2.5 py-1 text-[10px] font-bold uppercase text-white"
                      >
                        ยืนยันลบ
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          playSfx('click');
                          setConfirmDelete(code.code);
                        }}
                        className="rounded bg-white/5 px-2.5 py-1 text-[10px] uppercase text-gem/70 hover:bg-gem/10"
                      >
                        ลบ
                      </button>
                    )}
                  </span>
                </div>

                {code.rewards.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-end gap-2">
                    {code.rewards.map((reward, index) => (
                      <RewardChip key={index} reward={reward} size={30} showLabel={false} />
                    ))}
                  </div>
                )}

                {code.note && <p className="mt-2 text-[11px] text-chalk/45">“{code.note}”</p>}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
