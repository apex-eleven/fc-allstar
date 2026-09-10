/**
 * กรอกโค้ดรับของ — ฝั่งผู้เล่น
 *
 * ลำดับการทำงาน (ห้ามสลับ):
 *   1. อ่านเอกสารโค้ด → ตรวจว่าเปิดอยู่ ไม่หมดอายุ ยังไม่เต็มโควตา
 *   2. จองสิทธิ์ด้วยการสร้าง claims/{uid} ← ด่านกันรับซ้ำตัวจริง
 *   3. จองผ่านแล้วค่อยจ่ายของเข้าบัญชี
 *   4. บวกตัวนับ uses (พลาดได้ ไม่กระทบของที่ได้ไปแล้ว)
 *
 * ⚠️ ห้ามจ่ายของก่อนจองสิทธิ์เด็ดขาด — ถ้าจ่ายก่อนแล้วจองไม่ผ่าน
 * ผู้เล่นจะได้ของฟรีทุกครั้งที่กดซ้ำ
 */
import { useCallback, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePlayers } from '@/hooks/usePlayers';
import { ONLINE } from '@/services/accountStore';
import { createCardInstance } from '@/services/cardInstance';
import {
  bumpRedeemUses,
  claimRedeemCode,
  fetchRedeemCode,
  hasClaimed,
} from '@/services/firebase/redeemCodes';
import {
  checkRedeemable,
  isCodeShapeValid,
  normalizeCode,
  REDEEM_FAILURE_TEXT,
  usableRewards,
} from '@/services/redeemCode';
import { grantRewards } from '@/services/rewards';
import { playSfx } from '@/services/sound';
import type { RedeemFailure, RedeemResult } from '@/types/redeem';

const fail = (reason: RedeemFailure): RedeemResult => ({
  ok: false,
  reason,
  rewards: [],
  message: REDEEM_FAILURE_TEXT[reason],
});

export const useRedeem = () => {
  const { account } = useAuth();
  const { addCoins, addPoints, addUpgradePoints, addPassTickets, addUpgradeItems, addCards } =
    usePlayers();

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RedeemResult | null>(null);

  const uid = account?.id ?? null;

  const redeem = useCallback(
    async (rawCode: string): Promise<RedeemResult> => {
      const finish = (outcome: RedeemResult) => {
        setResult(outcome);
        playSfx(outcome.ok ? 'rankUp' : 'error');
        return outcome;
      };

      const code = normalizeCode(rawCode);
      if (!code) return finish(fail('empty'));
      if (!isCodeShapeValid(code)) return finish(fail('format'));
      if (!ONLINE || !uid) return finish(fail('offline'));

      setBusy(true);
      try {
        const doc = await fetchRedeemCode(code);
        const claimed = doc ? await hasClaimed(code, uid) : false;

        const blocked = checkRedeemable(doc, { claimed });
        if (blocked || !doc) return finish(fail(blocked ?? 'notFound'));

        // จองสิทธิ์ก่อน — ไม่ผ่านแปลว่ามีใบอยู่แล้ว (กดซ้ำ/กดพร้อมกันหลายแท็บ)
        const reserved = await claimRedeemCode(code, uid);
        if (!reserved) return finish(fail('alreadyClaimed'));

        const rewards = usableRewards(doc);
        grantRewards(rewards, {
          addCoins,
          addPoints,
          addUpgradePoints,
          addPassTickets,
          addUpgradeItems,
          // ของจากโค้ดถือเป็นของที่แอดมินตั้งใจแจก จึงข้ามระบบล็อกการ์ดเหมือนของขวัญ
          addCard: (playerId, upgrade) =>
            addCards([createCardInstance({ playerId, ownerId: uid, upgrade })], {
              ignoreLock: true,
            }),
        });

        // ตัวนับพลาดได้ ของเข้าบัญชีไปแล้วไม่ต้องย้อน
        bumpRedeemUses(code).catch((error) =>
          console.warn('[redeem] บวกตัวนับไม่สำเร็จ', error),
        );

        return finish({
          ok: true,
          reason: null,
          rewards,
          message: doc.note || 'รับของเรียบร้อย!',
        });
      } catch (error) {
        console.error('[redeem] รับของไม่สำเร็จ', error);
        return finish(fail('failed'));
      } finally {
        setBusy(false);
      }
    },
    [addCards, addCoins, addPassTickets, addPoints, addUpgradeItems, addUpgradePoints, uid],
  );

  return { redeem, busy, result, clear: () => setResult(null) };
};
