/**
 * ADMIN → ล็อกการ์ด
 *
 * เลือกนักเตะที่ยัง "ไม่อยากให้หลุดเข้าเกม" แล้วกดล็อก ผลคือใบนั้นหายจาก
 * ซองการ์ด · ผสมการ์ด · ตลาดซื้อขาย · ร้านแลกตามรอบ · ร้านแลกด้วยแต้ม · ดีลแลกการ์ด
 * และถูกตัดทิ้งที่ด่านสุดท้ายก่อนเข้าคลังผู้เล่น (usePlayers.addCards) ทุกกรณี
 *
 * ⚠️ ไม่ยึดของที่แจกไปแล้ว — ผู้เล่นที่มีอยู่ก่อนล็อกยังใช้ได้ครบทุกอย่าง
 * ⚠️ ของขวัญที่แอดมินเสกเองยังผ่านได้ ถือเป็นคำสั่งตรงของแอดมิน ไม่ใช่ "หาเจอในเกม"
 * ⚠️ การ์ดชุดเริ่มต้นของบัญชีใหม่ไม่ถูกกัน (ล็อกแล้วบัญชีใหม่จะจัด 11 ตัวจริงไม่ครบ)
 *    หน้านี้จึงติดป้ายเตือนไว้ที่ใบพวกนั้นแทนการบล็อกให้
 */
import { useEffect, useMemo, useState } from 'react';
import { PLAYERS } from '@/data/players';
import { STARTER_PLAYER_IDS } from '@/data/starter';
import { useGameConfig } from '@/hooks/useGameConfig';
import { CARD_LOCK_DEFAULT_NOTE, CARD_LOCK_MAX, normalizeCardLock } from '@/services/cardLock';
import { getBasePlayer } from '@/services/playerAttributes';
import { playSfx } from '@/services/sound';
import type { CardLockConfig } from '@/types/cardLock';
import { RARITY_ORDER, type Rarity } from '@/types/player';
import { cn, RARITY_STYLE } from '@/utils/helpers';

const STARTER_SET = new Set<string>(STARTER_PLAYER_IDS);

/** OVR ที่คิดค่าแก้ทับของแอดมินแล้ว — หน้านี้ดูใบต้นแบบ ไม่ใช่การ์ดของใครคนหนึ่ง */
const baseOvr = (playerId: string): number => getBasePlayer(playerId)?.ovr ?? 0;

type RarityFilter = Rarity | 'all';

export const CardLockPanel = () => {
  const { cardLock, saveCardLock, luckyGrid, pass, pointsExchange, exchangeDeals, packs } =
    useGameConfig();
  const [draft, setDraft] = useState<CardLockConfig>(cardLock);
  const [search, setSearch] = useState('');
  const [rarity, setRarity] = useState<RarityFilter>('all');
  const [lockedOnly, setLockedOnly] = useState(false);
  const [status, setStatus] = useState('');

  // ค่าจากเซิร์ฟเวอร์มาทีหลัง (onSnapshot) จึงต้องซิงก์ลงหน้าจอเมื่อมันเปลี่ยน
  useEffect(() => setDraft(cardLock), [cardLock]);

  const lockedSet = useMemo(() => new Set(draft.ids), [draft.ids]);

  const list = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return PLAYERS.filter((player) => {
      if (rarity !== 'all' && player.rarity !== rarity) return false;
      if (lockedOnly && !lockedSet.has(player.id)) return false;
      if (!keyword) return true;
      return (
        player.name.toLowerCase().includes(keyword) || player.id.toLowerCase().includes(keyword)
      );
    }).sort((left, right) => baseOvr(right.id) - baseOvr(left.id));
  }, [lockedOnly, lockedSet, rarity, search]);

  /**
   * ของที่แอดมินเลือกไว้เองแล้วบังเอิญไปชนกับใบที่ล็อก
   *
   * บอกไว้เพราะแต่ละระบบรับมือคนละแบบ: ร้านแต้มกับดีลจะดับไปเอง (ผู้เล่นไม่เห็น)
   * แต่กล่องสุ่มกับพาสเป็นช่องตายตัว ผู้เล่นยังหมุน/ปลดล็อกได้แต่จะไม่ได้การ์ด
   * แอดมินจึงควรไปเปลี่ยนรางวัลของสองอันนั้นเองก่อนล็อก
   */
  const impact = useMemo(() => {
    const hit = (id?: string) => Boolean(id && lockedSet.has(id));

    return {
      luckyGrid: luckyGrid.cells.filter((cell) => cell.type === 'card' && hit(cell.playerId)).length,
      pass: pass.levels.reduce(
        (sum, level) =>
          sum +
          [...level.free, ...level.premium, ...level.plus].filter((reward) => hit(reward.playerId))
            .length,
        0,
      ),
      pointsExchange: pointsExchange.items.filter((item) => hit(item.playerId)).length,
      deals: exchangeDeals.filter((deal) => deal.rewardPlayerIds.some((id) => hit(id))).length,
      packs: packs.filter((pack) => (pack.pool ?? []).some((id) => hit(id))).length,
    };
  }, [exchangeDeals, lockedSet, luckyGrid, packs, pass, pointsExchange]);

  /** ใบที่ล็อกแล้วอยู่ในชุดการ์ดเริ่มต้นด้วย — เตือนไว้ เพราะระบบไม่กันตรงนั้นให้ */
  const lockedStarters = useMemo(
    () => draft.ids.filter((id) => STARTER_SET.has(id)),
    [draft.ids],
  );

  const toggle = (playerId: string) => {
    playSfx('click');
    setDraft((prev) => {
      const ids = prev.ids.includes(playerId)
        ? prev.ids.filter((id) => id !== playerId)
        : [...prev.ids, playerId];
      return { ...prev, ids: ids.slice(0, CARD_LOCK_MAX) };
    });
  };

  /** ล็อก/ปลดล็อกทุกใบที่กรองอยู่ตอนนี้พร้อมกัน */
  const bulk = (lock: boolean) => {
    playSfx('click');
    const targets = list.map((player) => player.id);

    setDraft((prev) => {
      if (!lock) {
        const drop = new Set(targets);
        return { ...prev, ids: prev.ids.filter((id) => !drop.has(id)) };
      }
      return { ...prev, ids: Array.from(new Set([...prev.ids, ...targets])).slice(0, CARD_LOCK_MAX) };
    });
  };

  const save = async () => {
    playSfx('click');
    setStatus('กำลังบันทึก…');
    const error = await saveCardLock(normalizeCardLock(draft));
    setStatus(error ?? 'บันทึกแล้ว — ผู้เล่นทุกคนเห็นผลทันที');
  };

  const dirty = useMemo(
    () =>
      draft.ids.length !== cardLock.ids.length ||
      draft.note !== cardLock.note ||
      draft.ids.some((id) => !cardLock.ids.includes(id)),
    [cardLock, draft],
  );

  return (
    <section className="glass-panel space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="panel-title">ล็อกการ์ด</p>
          <p className="mt-1 text-xs text-chalk/45">
            ใบที่ล็อกจะหาไม่ได้จากทุกระบบ (ซอง · ผสม · ตลาด · ร้านแลก · กล่องสุ่ม · พาส) ·
            ผู้เล่นที่มีอยู่แล้วใช้ได้ตามปกติทุกอย่าง
          </p>
        </div>

        <div className="text-right">
          <p className="font-display text-2xl text-gem">{draft.ids.length}</p>
          <p className="font-mono text-[10px] uppercase text-chalk/35">ใบที่ล็อกอยู่</p>
        </div>
      </div>

      {lockedStarters.length > 0 && (
        <p className="rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-[11px] text-gold">
          มี {lockedStarters.length} ใบที่ล็อกไว้อยู่ในชุดการ์ดเริ่มต้นของบัญชีใหม่ ({lockedStarters.join(', ')})
          — บัญชีใหม่ยังได้รับใบพวกนี้อยู่ ถ้าไม่ตัดออกจะจัด 11 ตัวจริงไม่ครบ
        </p>
      )}

      {(impact.luckyGrid > 0 || impact.pass > 0) && (
        <p className="rounded-lg border border-gem/40 bg-gem/10 px-3 py-2 text-[11px] text-gem">
          รางวัลช่องตายตัวชนกับใบที่ล็อก — กล่องสุ่ม {impact.luckyGrid} ช่อง · พาส {impact.pass} รางวัล ·
          ผู้เล่นยังหมุน/ปลดล็อกได้แต่จะไม่ได้การ์ด ควรไปเปลี่ยนรางวัลของสองระบบนั้นก่อน
        </p>
      )}

      {(impact.pointsExchange > 0 || impact.deals > 0 || impact.packs > 0) && (
        <p className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-[11px] text-chalk/45">
          ระบบที่ปรับตัวเองให้แล้ว — ร้านแต้ม {impact.pointsExchange} ใบหายจากร้าน · ดีลแลกการ์ด{' '}
          {impact.deals} ดีลแลกไม่ได้ · ซองการ์ด {impact.packs} ซองตัดใบนั้นออกจากพูล
        </p>
      )}

      <label className="block">
        <span className="block font-mono text-[10px] uppercase tracking-wide text-chalk/45">
          ข้อความที่ผู้เล่นเห็น
        </span>
        <input
          value={draft.note}
          onChange={(event) => setDraft((prev) => ({ ...prev, note: event.target.value }))}
          placeholder={CARD_LOCK_DEFAULT_NOTE}
          maxLength={120}
          className="mt-1 w-full rounded-lg bg-white/5 px-3 py-2 text-xs outline-none focus:bg-white/10"
        />
      </label>

      {/* ── ตัวกรอง ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="ค้นหาชื่อหรือ id นักเตะ"
          className="min-w-[180px] flex-1 rounded-lg bg-white/5 px-3 py-2 text-xs outline-none focus:bg-white/10"
        />

        <div className="flex flex-wrap gap-1">
          {(['all', ...RARITY_ORDER] as RarityFilter[]).map((entry) => (
            <button
              key={entry}
              type="button"
              onClick={() => {
                playSfx('click');
                setRarity(entry);
              }}
              className={cn(
                'rounded-lg px-2.5 py-1.5 text-[10px] font-bold uppercase transition-colors',
                rarity === entry ? 'bg-neon text-ink-900' : 'bg-white/5 text-chalk/50',
              )}
            >
              {entry === 'all' ? 'ทั้งหมด' : RARITY_STYLE[entry].label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            playSfx('click');
            setLockedOnly((prev) => !prev);
          }}
          className={cn(
            'rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase transition-colors',
            lockedOnly ? 'bg-gem text-white' : 'bg-white/5 text-chalk/50',
          )}
        >
          เฉพาะที่ล็อก
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px] text-chalk/40">
        <span>กำลังแสดง {list.length} ใบ</span>
        <button
          type="button"
          onClick={() => bulk(true)}
          disabled={list.length === 0}
          className="rounded bg-white/5 px-2.5 py-1 uppercase text-chalk/60 hover:bg-white/10 disabled:opacity-30"
        >
          ล็อกทั้งหมดที่แสดง
        </button>
        <button
          type="button"
          onClick={() => bulk(false)}
          disabled={list.length === 0}
          className="rounded bg-white/5 px-2.5 py-1 uppercase text-chalk/60 hover:bg-white/10 disabled:opacity-30"
        >
          ปลดล็อกทั้งหมดที่แสดง
        </button>
      </div>

      {/* ── รายชื่อนักเตะ ───────────────────────────────────── */}
      <div className="max-h-[460px] overflow-y-auto rounded-xl border border-white/10 bg-black/25 p-2">
        {list.length === 0 ? (
          <p className="py-8 text-center text-xs text-chalk/40">ไม่มีนักเตะตรงเงื่อนไข</p>
        ) : (
          <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((player) => {
              const locked = lockedSet.has(player.id);

              return (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => toggle(player.id)}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors',
                    locked ? 'bg-gem/15 ring-1 ring-gem/50' : 'bg-white/[0.03] hover:bg-white/[0.07]',
                  )}
                >
                  <span className="w-4 shrink-0 text-center text-xs">{locked ? '🔒' : '　'}</span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs">{player.name}</span>
                    <span className="block font-mono text-[9px] text-chalk/30">
                      {player.id} · {player.position}
                      {STARTER_SET.has(player.id) && (
                        <span className="ml-1 text-gold/70">· ชุดเริ่มต้น</span>
                      )}
                    </span>
                  </span>

                  <span
                    className={cn(
                      'shrink-0 font-mono text-[9px] uppercase',
                      RARITY_STYLE[player.rarity].text,
                    )}
                  >
                    {RARITY_STYLE[player.rarity].label}
                  </span>
                  <span className="w-8 shrink-0 text-right font-mono text-[11px] text-chalk/50">
                    {baseOvr(player.id)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
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
            setDraft(cardLock);
            setStatus('ย้อนกลับเป็นค่าที่บันทึกไว้แล้ว');
          }}
          disabled={!dirty}
          className="rounded-lg bg-white/5 px-4 py-2 text-xs uppercase text-chalk/60 hover:bg-white/10 disabled:opacity-30"
        >
          ยกเลิกที่แก้
        </button>
        {dirty && <span className="text-[11px] text-gold">ยังไม่ได้บันทึก</span>}
        {status && <p className="text-xs text-chalk/55">{status}</p>}
      </div>
    </section>
  );
};
