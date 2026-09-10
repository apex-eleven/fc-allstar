/**
 * หน้า REDEEM — กรอกโค้ดรับของ
 *
 * จอเดียวจบ: ช่องกรอก + ปุ่มรับ + ผลลัพธ์
 * ช่องกรอกแปลงเป็นตัวพิมพ์ใหญ่และตัดช่องว่างให้เองระหว่างพิมพ์ เพราะผู้เล่นส่วนใหญ่
 * ก๊อปโค้ดมาจากโพสต์หรือพิมพ์ตามรูป แล้วติดช่องว่าง/ตัวพิมพ์เล็กมาด้วยเป็นประจำ
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { RewardChip } from '@/components/rewards/RewardChip';
import { useRedeem } from '@/hooks/useRedeem';
import { normalizeCode, REDEEM_CODE_MAX } from '@/services/redeemCode';
import { cn } from '@/utils/helpers';

export const RedeemPage = () => {
  const { redeem, busy, result, clear } = useRedeem();
  const [code, setCode] = useState('');

  const submit = async () => {
    const outcome = await redeem(code);
    // สำเร็จแล้วล้างช่อง ป้องกันการกดซ้ำโดยไม่ตั้งใจแล้วเจอข้อความ "รับไปแล้ว"
    if (outcome.ok) setCode('');
  };

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-chalk/35">
        <Link to="/" className="hover:text-neon">
          Home
        </Link>
        <span>/</span>
        <span className="text-chalk/70">Redeem</span>
      </div>

      <section className="panel p-5">
        <h1 className="font-display text-2xl uppercase tracking-wide">กรอกโค้ดรับของ</h1>
        <p className="mt-1 text-xs text-chalk/50">
          ใส่โค้ดที่ได้รับจากกิจกรรมหรือเพจของเกม ของจะเข้าบัญชีทันที · หนึ่งโค้ดรับได้คนละครั้งเดียว
        </p>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            value={code}
            maxLength={REDEEM_CODE_MAX}
            onChange={(event) => {
              setCode(normalizeCode(event.target.value));
              if (result) clear();
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !busy) void submit();
            }}
            placeholder="เช่น FCA-7K3PQZ"
            className="flex-1 rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-center font-mono text-lg tracking-[0.2em] outline-none placeholder:tracking-normal placeholder:text-chalk/25 focus:border-neon/50"
          />

          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy || code.length === 0}
            className={cn(
              'rounded-lg px-8 py-3 font-display text-base uppercase tracking-wide transition-colors',
              busy || code.length === 0
                ? 'cursor-not-allowed bg-white/5 text-chalk/30'
                : 'bg-neon text-ink-900 hover:brightness-110',
            )}
          >
            {busy ? 'กำลังตรวจ…' : 'รับของ'}
          </button>
        </div>

        {result && (
          <div
            className={cn(
              'mt-4 rounded-xl border p-4',
              result.ok ? 'border-neon/40 bg-neon/5' : 'border-gem/40 bg-gem/10',
            )}
          >
            <p className={cn('text-sm font-semibold', result.ok ? 'text-neon' : 'text-gem')}>
              {result.message}
            </p>

            {result.rewards.length > 0 && (
              <div className="mt-3 flex flex-wrap items-end gap-3">
                {result.rewards.map((reward, index) => (
                  <RewardChip key={index} reward={reward} size={44} />
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
