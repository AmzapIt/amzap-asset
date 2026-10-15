import { getDbPool, query } from './db.js';
import { getCurrentAccessories, getReportAssets } from './asset-report.js';
import { AssetWorkflowError } from './asset-scan.js';
import { formatUserDisplayName } from './user-display.js';
import { isAmzapVerificationUser } from './verification-eligibility.js';

const validId = (value) => typeof value === 'string' && /^[1-9]\d{0,18}$/.test(value)
  && BigInt(value) <= 9223372036854775807n;
const bangkokDate = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

function assertId(id) {
  if (!validId(id)) throw new AssetWorkflowError('รหัสรายการไม่ถูกต้อง');
}

export function verificationNumber(year, roundNo, sequenceNo) {
  if (!Number.isInteger(year) || year < 2020 || year > 2100 ||
      !Number.isInteger(roundNo) || roundNo < 1 || roundNo > 99 ||
      !Number.isInteger(sequenceNo) || sequenceNo < 1 || sequenceNo > 9999) {
    throw new AssetWorkflowError('ลำดับเลขใบตรวจไม่ถูกต้อง');
  }
  return `AV-${year}-${String(roundNo).padStart(2, '0')}-${String(sequenceNo).padStart(4, '0')}`;
}

export async function listVerificationRounds() {
  return (await query(`SELECT r.id::text, r.year, r.round_no, r.title, r.created_at::text,
    COUNT(DISTINCT v.id) FILTER (WHERE v.status <> 'cancelled')::int AS issued_count,
    COUNT(DISTINCT v.id) FILTER (WHERE v.status = 'signed')::int AS signed_count
    FROM public.asset_verification_rounds r
    LEFT JOIN public.asset_verification_records v ON v.round_id=r.id
    GROUP BY r.id ORDER BY r.year DESC,r.round_no DESC LIMIT 100`)).rows;
}

export async function createVerificationRound(input, accountId) {
  const year = Number(input?.year);
  const roundNo = Number(input?.roundNo);
  const title = typeof input?.title === 'string' ? input.title.trim() : '';
  if (!Number.isInteger(year) || year < 2020 || year > 2100 ||
      !Number.isInteger(roundNo) || roundNo < 1 || roundNo > 99 ||
      title.length < 1 || title.length > 120) {
    throw new AssetWorkflowError('กรุณาระบุปี รอบตรวจ และชื่อรอบให้ถูกต้อง');
  }
  try {
    return (await query(`INSERT INTO public.asset_verification_rounds
      (year,round_no,title,created_by_account_id) VALUES ($1,$2,$3,$4)
      RETURNING id::text,year,round_no,title`, [year, roundNo, title, accountId])).rows[0];
  } catch (error) {
    if (error.code === '23505') throw new AssetWorkflowError('ปีและรอบตรวจนี้มีอยู่แล้ว', 409);
    throw error;
  }
}

export async function deleteVerificationRound(id, input) {
  assertId(id);
  const client = await getDbPool().connect();
  try {
    await client.query('BEGIN');
    const round = (await client.query(`SELECT id::text,title FROM public.asset_verification_rounds
      WHERE id=$1 FOR UPDATE`, [id])).rows[0];
    if (!round) throw new AssetWorkflowError('ไม่พบรอบตรวจ', 404);
    if (input?.confirmTitle !== round.title) {
      throw new AssetWorkflowError('กรุณาพิมพ์ชื่อรอบตรวจให้ตรงเพื่อยืนยันการลบ');
    }
    const records = (await client.query(`SELECT id,status FROM public.asset_verification_records
      WHERE round_id=$1 FOR UPDATE`, [id])).rows;
    if (records.some((record) => record.status === 'signed')) {
      throw new AssetWorkflowError('รอบนี้มีใบตรวจที่รับลายเซ็นแล้ว จึงไม่สามารถลบรอบได้', 409);
    }
    if (records.length !== input?.expectedRecords) {
      throw new AssetWorkflowError('จำนวนใบตรวจเปลี่ยนไป กรุณาโหลดหน้าใหม่ก่อนลบ', 409);
    }
    await client.query('DELETE FROM public.asset_verification_records WHERE round_id=$1', [id]);
    await client.query('DELETE FROM public.asset_verification_rounds WHERE id=$1', [id]);
    await client.query('COMMIT');
    return { deletedRecords: records.length };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

export function selectPrintableVerificationRecords(records) {
  return records.filter((record) => record.status !== 'cancelled' &&
    Array.isArray(record.snapshot?.assets) && record.snapshot.assets.length > 0);
}

export async function getVerificationPrintBatch(roundId) {
  assertId(roundId);
  const result = await query(`SELECT v.id::text,v.document_no,v.form_revision,v.snapshot,v.status,
    r.year,r.round_no,r.title AS round_title
    FROM public.asset_verification_rounds r
    LEFT JOIN public.asset_verification_records v ON v.round_id=r.id
    WHERE r.id=$1 ORDER BY v.sequence_no,v.id`, [roundId]);
  if (!result.rows.length) throw new AssetWorkflowError('ไม่พบรอบตรวจ', 404);
  const records = selectPrintableVerificationRecords(result.rows.filter((row) => row.id));
  if (!records.length) throw new AssetWorkflowError('ไม่มีใบตรวจของผู้มี Asset ที่พร้อมพิมพ์ในรอบนี้', 409);
  return { round: { year: result.rows[0].year, round_no: result.rows[0].round_no }, records };
}

export function selectBatchVerificationUsers(users, assets, existingRecords) {
  const assetsByUser = new Map();
  for (const asset of assets) if (asset.current_holder_id) {
    const holdings = assetsByUser.get(asset.current_holder_id) || [];
    holdings.push(asset);
    assetsByUser.set(asset.current_holder_id, holdings);
  }
  const existingByUser = new Map(existingRecords.filter((record) => record.status !== 'cancelled')
    .map((record) => [record.user_id, record]));
  return users.filter((user) => {
    return isAmzapVerificationUser(user) && !!assetsByUser.get(user.id)?.length;
  }).map((user) => ({ user, assets: assetsByUser.get(user.id),
    existing: existingByUser.get(user.id) }));
}

export async function prepareVerificationPrintBatch(roundId, input, accountId) {
  assertId(roundId);
  const expected = input?.expectedHoldings;
  if (!Array.isArray(expected) ||
    expected.length < 1 || expected.length > 1000 ||
    expected.some((entry) => !validId(entry?.userId) || !Array.isArray(entry.assetIds) ||
      entry.assetIds.length < 1 || entry.assetIds.length > 1000 ||
      entry.assetIds.some((id) => !validId(id)))) {
    throw new AssetWorkflowError('รายชื่อสำหรับพิมพ์ไม่ถูกต้อง');
  }
  // Snapshot one live view for this batch. Existing numbered forms are never overwritten.
  const [userResult, assets, accessories] = await Promise.all([
    query(`SELECT u.id::text,u.employee_code,u.full_name,u.nickname,u."position",u.is_active,
      u.location_id::text,
      d.name AS department FROM public."user" u
      LEFT JOIN public.departments d ON d.id=u.department_id
      WHERE u.is_active AND u.location_id IN (1,2) ORDER BY u.full_name,u.id`),
    getReportAssets(),
    getCurrentAccessories(),
  ]);
  const accessoriesByUser = new Map();
  for (const item of accessories) {
    const holdings = accessoriesByUser.get(item.user_id) || [];
    holdings.push(item);
    accessoriesByUser.set(item.user_id, holdings);
  }
  const client = await getDbPool().connect();
  try {
    await client.query('BEGIN');
    const round = (await client.query(`SELECT year,round_no,next_sequence
      FROM public.asset_verification_rounds WHERE id=$1 FOR UPDATE`, [roundId])).rows[0];
    if (!round) throw new AssetWorkflowError('ไม่พบรอบตรวจ', 404);
    const existing = (await client.query(`SELECT id::text,user_id::text,document_no,
      form_revision,snapshot,status FROM public.asset_verification_records
      WHERE round_id=$1 AND status<>'cancelled' FOR UPDATE`, [roundId])).rows;
    const selected = selectBatchVerificationUsers(userResult.rows, assets, existing);
    const expectedSignature = expected.map((entry) =>
      `${entry.userId}:${[...entry.assetIds].sort().join(',')}`).sort().join('|');
    const actualSignature = selected.map(({ user, assets: holdings }) =>
      `${user.id}:${holdings.map((asset) => asset.id).sort().join(',')}`).sort().join('|');
    if (expectedSignature !== actualSignature) {
      throw new AssetWorkflowError('รายชื่อหรือ Asset เปลี่ยนไป กรุณาโหลดหน้าใหม่และตรวจทานก่อนพิมพ์', 409);
    }
    const activeNow = (await client.query(`SELECT id::text FROM public."user"
      WHERE id=ANY($1::bigint[]) AND is_active AND location_id IN (1,2) FOR SHARE`,
    [selected.map(({ user }) => user.id)])).rows;
    if (activeNow.length !== selected.length) {
      throw new AssetWorkflowError('สถานะพนักงานเปลี่ยนไป กรุณาโหลดหน้าใหม่ก่อนพิมพ์', 409);
    }
    const records = [];
    let nextSequence = Number(round.next_sequence);
    let createdCount = 0;
    for (const { user, assets: holdings, existing: previous } of selected) {
      if (previous) {
        if (!previous.snapshot?.assets?.length) {
          throw new AssetWorkflowError(`ใบเดิมของ ${user.full_name} ไม่มี Asset กรุณายกเลิกใบเดิมก่อนพิมพ์รวม`, 409);
        }
        records.push({ ...previous, year: round.year, round_no: round.round_no });
        continue;
      }
      const documentNo = verificationNumber(round.year, round.round_no, nextSequence);
      const snapshot = {
        employee: { id: user.id, employee_code: user.employee_code, full_name: user.full_name,
          nickname: user.nickname, position: user.position, department: user.department },
        assets: holdings.map((asset) => ({ id: asset.id, asset_code: asset.asset_code,
          asset_name: asset.asset_name, asset_type: asset.asset_type, brand: asset.brand,
          model: asset.model, serial_number: asset.serial_number, holder_source: asset.holder_source })),
        accessories: (accessoriesByUser.get(user.id) || []).map((item) => ({
          id: item.id, accessory_type: item.accessory_type, brand: item.brand,
          model: item.model, serial_number: item.serial_number, quantity: Number(item.quantity) })),
        issued_date: bangkokDate(),
      };
      const record = (await client.query(`INSERT INTO public.asset_verification_records
        (round_id,user_id,sequence_no,document_no,snapshot,issued_by_account_id)
        VALUES ($1,$2,$3,$4,$5::jsonb,$6)
        RETURNING id::text,user_id::text,document_no,form_revision,snapshot,status`,
      [roundId, user.id, nextSequence, documentNo, JSON.stringify(snapshot), accountId])).rows[0];
      records.push({ ...record, year: round.year, round_no: round.round_no });
      nextSequence++;
      createdCount++;
    }
    if (createdCount) await client.query(`UPDATE public.asset_verification_rounds
      SET next_sequence=$2 WHERE id=$1`, [roundId, nextSequence]);
    await client.query('COMMIT');
    return { round, records, createdCount };
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') throw new AssetWorkflowError('มีการออกใบตรวจพร้อมกัน กรุณาโหลดหน้าใหม่', 409);
    throw error;
  } finally { client.release(); }
}

export async function getVerificationRound(id) {
  assertId(id);
  const round = (await query(`SELECT id::text,year,round_no,title,created_at::text
    FROM public.asset_verification_rounds WHERE id=$1`, [id])).rows[0];
  if (!round) throw new AssetWorkflowError('ไม่พบรอบตรวจ', 404);
  const [users, assets, accessories, records] = await Promise.all([
    query(`SELECT u.id::text,u.employee_code,u.full_name,u.nickname,u.is_active,
      u.location_id::text,
      d.name AS department FROM public."user" u
      LEFT JOIN public.departments d ON d.id=u.department_id
      WHERE u.location_id IN (1,2) AND (u.is_active OR EXISTS (
        SELECT 1 FROM public.asset_verification_records v
        WHERE v.round_id=$1 AND v.user_id=u.id))
      ORDER BY u.is_active DESC,u.full_name,u.id`, [id]),
    getReportAssets(),
    getCurrentAccessories(),
    query(`SELECT id::text, user_id::text, document_no, status, issued_at::text,
      signed_date::text, check_result, check_notes, cancel_reason, snapshot
      FROM public.asset_verification_records WHERE round_id=$1 ORDER BY id DESC`, [id]),
  ]);
  const counts = new Map();
  const holdings = new Map();
  for (const asset of assets) if (asset.current_holder_id) {
    const current = counts.get(asset.current_holder_id) || { assets: 0, accessories: 0, legacy: 0 };
    current.assets++;
    if (asset.holder_source === 'Asset Owner (legacy)') current.legacy++;
    counts.set(asset.current_holder_id, current);
    const currentItems = holdings.get(asset.current_holder_id) || { assets: [], accessories: [] };
    currentItems.assets.push({ id: asset.id, asset_code: asset.asset_code,
      asset_name: asset.asset_name, holder_source: asset.holder_source });
    holdings.set(asset.current_holder_id, currentItems);
  }
  for (const item of accessories) {
    const current = counts.get(item.user_id) || { assets: 0, accessories: 0, legacy: 0 };
    current.accessories += Number(item.quantity);
    counts.set(item.user_id, current);
    const currentItems = holdings.get(item.user_id) || { assets: [], accessories: [] };
    currentItems.accessories.push({ id: item.id, accessory_type: item.accessory_type,
      quantity: Number(item.quantity) });
    holdings.set(item.user_id, currentItems);
  }
  return {
    round,
    users: users.rows.map((user) => ({ ...user,
      display_name: formatUserDisplayName(user),
      counts: counts.get(user.id) || { assets: 0, accessories: 0, legacy: 0 },
      holdings: holdings.get(user.id) || { assets: [], accessories: [] },
    })),
    records: records.rows,
  };
}

export async function issueVerification(roundId, userId, accountId) {
  assertId(roundId);
  assertId(userId);
  // Capture live holdings once. Subsequent PDF downloads use only this snapshot.
  const [userResult, assets, accessories] = await Promise.all([
    query(`SELECT u.id::text,u.employee_code,u.full_name,u.nickname,u."position",u.is_active,
      u.location_id::text,
      d.name AS department FROM public."user" u
      LEFT JOIN public.departments d ON d.id=u.department_id WHERE u.id=$1`, [userId]),
    getReportAssets(),
    getCurrentAccessories(userId),
  ]);
  const user = userResult.rows[0];
  if (!isAmzapVerificationUser(user)) throw new AssetWorkflowError('เลือกได้เฉพาะพนักงาน Amzap ที่ Active');
  const snapshot = {
    employee: { id: user.id, employee_code: user.employee_code, full_name: user.full_name,
      nickname: user.nickname, position: user.position, department: user.department },
    assets: assets.filter((asset) => asset.current_holder_id === userId).map((asset) => ({
      id: asset.id, asset_code: asset.asset_code, asset_name: asset.asset_name,
      asset_type: asset.asset_type, brand: asset.brand, model: asset.model,
      serial_number: asset.serial_number, holder_source: asset.holder_source,
    })),
    accessories: accessories.map((item) => ({ id: item.id, accessory_type: item.accessory_type,
      brand: item.brand, model: item.model, serial_number: item.serial_number,
      quantity: Number(item.quantity) })),
    issued_date: bangkokDate(),
  };
  const client = await getDbPool().connect();
  try {
    await client.query('BEGIN');
    const round = (await client.query(`SELECT year,round_no,next_sequence FROM public.asset_verification_rounds
      WHERE id=$1 FOR UPDATE`, [roundId])).rows[0];
    if (!round) throw new AssetWorkflowError('ไม่พบรอบตรวจ', 404);
    const currentUser = (await client.query('SELECT is_active,location_id::text FROM public."user" WHERE id=$1', [userId])).rows[0];
    if (!isAmzapVerificationUser(currentUser)) {
      throw new AssetWorkflowError('พนักงานไม่ใช่ Amzap ที่ Active แล้ว', 409);
    }
    const existing = (await client.query(`SELECT id::text,document_no FROM public.asset_verification_records
      WHERE round_id=$1 AND user_id=$2 AND status<>'cancelled'`, [roundId, userId])).rows[0];
    if (existing) throw new AssetWorkflowError(`พนักงานคนนี้มีใบตรวจ ${existing.document_no} แล้ว`, 409);
    const sequence = Number(round.next_sequence);
    const documentNo = verificationNumber(round.year, round.round_no, sequence);
    await client.query('UPDATE public.asset_verification_rounds SET next_sequence=next_sequence+1 WHERE id=$1', [roundId]);
    const record = (await client.query(`INSERT INTO public.asset_verification_records
      (round_id,user_id,sequence_no,document_no,snapshot,issued_by_account_id)
      VALUES ($1,$2,$3,$4,$5::jsonb,$6) RETURNING id::text,document_no,status`,
    [roundId, userId, sequence, documentNo, JSON.stringify(snapshot), accountId])).rows[0];
    await client.query('COMMIT');
    return record;
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') throw new AssetWorkflowError('มีใบตรวจของพนักงานในรอบนี้แล้ว กรุณาโหลดหน้าใหม่', 409);
    throw error;
  } finally { client.release(); }
}

export async function getVerificationRecord(id) {
  assertId(id);
  const record = (await query(`SELECT v.id::text,v.round_id::text,v.user_id::text,v.document_no,
    v.form_revision,v.snapshot,v.status,v.issued_at::text,v.signed_date::text,
    v.check_result,v.check_notes,
    v.cancel_reason,r.title AS round_title,r.year,r.round_no
    FROM public.asset_verification_records v
    JOIN public.asset_verification_rounds r ON r.id=v.round_id WHERE v.id=$1`, [id])).rows[0];
  if (!record) throw new AssetWorkflowError('ไม่พบใบตรวจ', 404);
  return record;
}

export async function updateVerificationRecord(id, input, accountId) {
  assertId(id);
  if (input?.action === 'signed') {
    const date = String(input.signedDate || bangkokDate());
    const resultValue = input.checkResult;
    const notes = String(input.notes || '').trim();
    const parsed = new Date(`${date}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== date) throw new AssetWorkflowError('วันที่รับเอกสารไม่ถูกต้อง');
    if (date > bangkokDate()) throw new AssetWorkflowError('วันที่รับเอกสารต้องไม่เป็นอนาคต');
    if (!['matched', 'discrepancy'].includes(resultValue) || notes.length > 1000 ||
      (resultValue === 'discrepancy' && notes.length < 3)) {
      throw new AssetWorkflowError('กรุณาระบุผลตรวจและรายละเอียดกรณีข้อมูลไม่ตรง');
    }
    const result = await query(`UPDATE public.asset_verification_records SET
      status='signed',signed_date=$2,check_result=$3,check_notes=$4,
      signed_at=now(),signed_by_account_id=$5
      WHERE id=$1 AND status='issued' AND $2::date >= (snapshot->>'issued_date')::date
      RETURNING id::text,document_no,status`,
    [id, date, resultValue, notes || null, accountId]);
    if (!result.rows[0]) throw new AssetWorkflowError('ใบตรวจไม่อยู่ในสถานะรอรับเอกสาร หรือวันที่รับก่อนวันที่ออกใบ', 409);
    return result.rows[0];
  }
  if (input?.action === 'cancel') {
    const reason = String(input.reason || '').trim();
    if (reason.length < 3 || reason.length > 500) throw new AssetWorkflowError('กรุณาระบุเหตุผลยกเลิก 3–500 ตัวอักษร');
    const result = await query(`UPDATE public.asset_verification_records SET
      status='cancelled',cancel_reason=$2,cancelled_at=now(),cancelled_by_account_id=$3
      WHERE id=$1 AND status='issued' RETURNING id::text,document_no,status`, [id, reason, accountId]);
    if (!result.rows[0]) throw new AssetWorkflowError('ยกเลิกได้เฉพาะใบตรวจที่ยังไม่รับเอกสาร', 409);
    return result.rows[0];
  }
  throw new AssetWorkflowError('คำสั่งไม่ถูกต้อง');
}
