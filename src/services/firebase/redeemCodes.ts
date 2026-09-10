/**
 * โค้ดรับของ — ชั้นที่คุยกับ Firestore
 *
 * โครงเอกสาร
 *   redeemCodes/{CODE}              ← ตัวโค้ดกับของรางวัล แอดมินเขียน ทุกคนอ่านได้
 *   redeemCodes/{CODE}/claims/{uid} ← ใบยืนยันว่าคนนี้รับไปแล้ว เจ้าของ uid สร้างเองได้อย่างเดียว
 *
 * ⚠️ ทำไมนับ uses ด้วย increment แทนที่จะนับจำนวนใบใน claims
 * เพราะกฎ Firestore ตรวจเงื่อนไข "ยังไม่เกินโควตา" ได้เฉพาะกับค่าที่อยู่ในเอกสารเดียวกัน
 * การนับจากซับคอลเลกชันต้องอ่านทั้งชุดก่อนทุกครั้ง ทั้งช้าและกันแซงไม่ได้จริง
 * ส่วนสิทธิ์เขียนถูกล็อกไว้แน่นในกฎ — ผู้เล่นแก้ได้แค่ช่อง uses และบวกได้ทีละ 1 เท่านั้น
 *
 * ⚠️ ลำดับสำคัญ: สร้างใบ claims ให้สำเร็จ "ก่อน" แล้วค่อยบวก uses
 * ใบ claims คือด่านกันรับซ้ำตัวจริง ถ้าบวก uses ก่อนแล้วสร้างใบไม่ผ่าน
 * โควตาจะหายไปหนึ่งช่องโดยไม่มีใครได้ของ
 */
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { getFirebase } from '@/services/firebase/config';
import { normalizeCode, normalizeRedeemCode } from '@/services/redeemCode';
import type { RedeemCodeDoc } from '@/types/redeem';

const CODES = 'redeemCodes';
const CLAIMS = 'claims';

/** เฝ้ารายการโค้ดทั้งหมด (ใช้ในหน้าแอดมินเท่านั้น) */
export const watchRedeemCodes = (
  onCodes: (codes: RedeemCodeDoc[]) => void,
): (() => void) => {
  const firebase = getFirebase();
  if (!firebase) return () => undefined;

  return onSnapshot(
    query(collection(firebase.db, CODES)),
    (snapshot) => {
      const codes = snapshot.docs.map((entry) =>
        normalizeRedeemCode(entry.data() as Partial<RedeemCodeDoc>, entry.id),
      );
      // ใหม่สุดขึ้นก่อน แอดมินจะได้เห็นโค้ดที่เพิ่งสร้างทันทีโดยไม่ต้องเลื่อนหา
      codes.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      onCodes(codes);
    },
    (error) => console.error('[redeem] อ่านรายการโค้ดไม่สำเร็จ', error),
  );
};

/** อ่านโค้ดใบเดียว — คืน null เมื่อไม่มีโค้ดนี้ */
export const fetchRedeemCode = async (rawCode: string): Promise<RedeemCodeDoc | null> => {
  const firebase = getFirebase();
  if (!firebase) throw new Error('offline');

  const code = normalizeCode(rawCode);
  const snapshot = await getDoc(doc(firebase.db, CODES, code));
  if (!snapshot.exists()) return null;

  return normalizeRedeemCode(snapshot.data() as Partial<RedeemCodeDoc>, code);
};

/** คนนี้เคยรับโค้ดนี้ไปแล้วหรือยัง */
export const hasClaimed = async (rawCode: string, uid: string): Promise<boolean> => {
  const firebase = getFirebase();
  if (!firebase) throw new Error('offline');

  const snapshot = await getDoc(doc(firebase.db, CODES, normalizeCode(rawCode), CLAIMS, uid));
  return snapshot.exists();
};

/**
 * จองสิทธิ์รับโค้ด — คืน false เมื่อคนนี้เคยรับไปแล้ว
 *
 * ใช้ setDoc ธรรมดาแต่กฎอนุญาตเฉพาะ create เอกสารที่ยังไม่มี
 * การกดรับซ้ำจึงกลายเป็น update และถูกเซิร์ฟเวอร์ปฏิเสธเสมอ
 * ไม่ว่าจะกดรัว ๆ จากหลายแท็บพร้อมกันแค่ไหนก็ตาม
 */
export const claimRedeemCode = async (rawCode: string, uid: string): Promise<boolean> => {
  const firebase = getFirebase();
  if (!firebase) throw new Error('offline');

  const code = normalizeCode(rawCode);

  try {
    await setDoc(doc(firebase.db, CODES, code, CLAIMS, uid), {
      uid,
      claimedAt: new Date().toISOString(),
    });
    return true;
  } catch (error) {
    // permission-denied ตรงนี้แปลว่ามีใบอยู่แล้ว = เคยรับไปแล้ว ไม่ใช่ระบบพัง
    console.warn('[redeem] จองสิทธิ์ไม่สำเร็จ (น่าจะเคยรับไปแล้ว)', error);
    return false;
  }
};

/**
 * บวกจำนวนครั้งที่ถูกใช้ไปหนึ่ง
 * ล้มเหลวได้โดยไม่ถือว่าการรับของล้มเหลว — ใบ claims จองสิทธิ์ไว้เรียบร้อยแล้ว
 * อย่างมากที่สุดคือตัวนับในหน้าแอดมินต่ำกว่าความจริงชั่วคราว
 */
export const bumpRedeemUses = async (rawCode: string): Promise<void> => {
  const firebase = getFirebase();
  if (!firebase) return;

  await updateDoc(doc(firebase.db, CODES, normalizeCode(rawCode)), { uses: increment(1) });
};

/** สร้างหรือแก้โค้ด (แอดมินเท่านั้น — กฎเป็นคนบังคับ) */
export const saveRedeemCode = async (input: RedeemCodeDoc): Promise<void> => {
  const firebase = getFirebase();
  if (!firebase) throw new Error('offline');

  const clean = normalizeRedeemCode(input);
  await setDoc(doc(firebase.db, CODES, clean.code), clean);
};

/** ลบโค้ดทิ้ง พร้อมใบรับทั้งหมดของโค้ดนั้น */
export const deleteRedeemCode = async (rawCode: string): Promise<void> => {
  const firebase = getFirebase();
  if (!firebase) throw new Error('offline');

  const code = normalizeCode(rawCode);
  const claims = await getDocs(collection(firebase.db, CODES, code, CLAIMS));

  // ลบใบรับก่อน ไม่งั้นซับคอลเลกชันจะค้างอยู่แม้เอกสารแม่หายไปแล้ว
  await Promise.all(claims.docs.map((entry) => deleteDoc(entry.ref)));
  await deleteDoc(doc(firebase.db, CODES, code));
};
