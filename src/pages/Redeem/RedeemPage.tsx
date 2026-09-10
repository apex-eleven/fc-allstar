/**
 * หน้า REDEEM — กรอกโค้ดรับของ
 *
 * จอเดียวจบ: ช่องกรอก + ปุ่มรับ + ผลลัพธ์ + ทางเข้าดิสคอร์ดที่ใช้ประกาศโค้ด
 * ช่องกรอกแปลงเป็นตัวพิมพ์ใหญ่และตัดช่องว่างให้เองระหว่างพิมพ์ เพราะผู้เล่นส่วนใหญ่
 * ก๊อปโค้ดมาจากโพสต์หรือพิมพ์ตามรูป แล้วติดช่องว่าง/ตัวพิมพ์เล็กมาด้วยเป็นประจำ
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { RewardChip } from '@/components/rewards/RewardChip';
import { useRedeem } from '@/hooks/useRedeem';
import { normalizeCode, REDEEM_CODE_MAX } from '@/services/redeemCode';
import { cn } from '@/utils/helpers';

/**
 * ลิงก์เชิญเข้าดิสคอร์ดของเกม
 * ⚠️ ลิงก์เชิญมีวันหมดอายุได้ ถ้าเปลี่ยนเมื่อไหร่ให้แก้ที่นี่ที่เดียว
 * (ตั้งลิงก์เป็นแบบ "ไม่มีวันหมดอายุ" ในหน้าตั้งค่าเซิร์ฟเวอร์ดิสคอร์ดได้ แนะนำให้ทำ)
 */
const DISCORD_INVITE = 'https://discord.gg/kcfFMQr2zr';

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

      {/*
        ทางเข้าดิสคอร์ด — วางไว้ใต้ช่องกรอกโดยตั้งใจ
        คนที่เข้าหน้านี้ส่วนใหญ่มาเพราะเห็นโค้ดจากที่อื่น หรือมาแล้วไม่มีโค้ดจะกรอก
        กลุ่มหลังคือคนที่ควรเห็นทางไปหาโค้ดมากที่สุด
      */}
      <a
        href={DISCORD_INVITE}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-center gap-4 rounded-xl border border-[#5865F2]/40 bg-[#5865F2]/10 p-4 transition-colors hover:border-[#5865F2]/70 hover:bg-[#5865F2]/20"
      >
        <img
          src="/icons/discord.svg"
          alt="Discord"
          width={40}
          height={40}
          className="shrink-0"
          loading="lazy"
        />

        <span className="min-w-0 flex-1">
          <span className="block font-display text-base uppercase tracking-wide">
            เข้าร่วมดิสคอร์ดของเกม
          </span>
          <span className="block text-xs text-chalk/50">
            โค้ดรับของใหม่ ๆ ประกาศที่นี่ก่อนใคร พร้อมข่าวอัปเดตและกิจกรรม
          </span>
        </span>

        <span className="shrink-0 rounded-lg bg-[#5865F2] px-4 py-2 font-display text-sm uppercase tracking-wide text-white transition-transform group-hover:scale-105">
          เข้าร่วม
        </span>
      </a>
    </div>
  );
};
