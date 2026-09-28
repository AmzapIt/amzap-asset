import { getDbPool } from "./db.js";
import { accessoryId } from "./accessory-inventory.js";

export function accessoryMovementFilters(url) {
  const {searchParams}=new URL(url);
  return {before:searchParams.get("before"),stockId:searchParams.get("stock_id"),userId:searchParams.get("user_id")};
}

export async function getAccessoryMovements({ before, stockId, userId } = {}, pool = getDbPool()) {
  const result = await pool.query(`SELECT m.id::text,m.stock_item_id::text,m.employee_accessory_id::text,
    m.related_accessory_id::text,m.action,m.quantity,m.stock_delta,m.balance_after,m.event_date::text,
    m.reason,m.notes,m.details,m.created_at,t.name AS accessory_type,s.brand,s.model,s.serial_number,
    fu.full_name AS from_name,fu.nickname AS from_nickname,tu.full_name AS to_name,tu.nickname AS to_nickname,
    a.display_name AS actor_name
    FROM public.accessory_stock_movements m
    JOIN public.accessory_stock_items s ON s.id=m.stock_item_id
    JOIN public.accessory_types t ON t.id=s.accessory_type_id
    LEFT JOIN public."user" fu ON fu.id=m.from_user_id
    LEFT JOIN public."user" tu ON tu.id=m.to_user_id
    LEFT JOIN public.app_accounts a ON a.id=m.actor_account_id
    WHERE ($1::bigint IS NULL OR m.id<$1) AND ($2::bigint IS NULL OR m.stock_item_id=$2)
      AND ($3::bigint IS NULL OR m.from_user_id=$3 OR m.to_user_id=$3)
    ORDER BY m.id DESC LIMIT 101`, [before?accessoryId(before):null,stockId?accessoryId(stockId):null,userId?accessoryId(userId):null]);
  return { movements:result.rows.slice(0,100), hasMore:result.rows.length>100 };
}

export async function getAccessoryInventory(pool = getDbPool()) {
  const [stocks, types, users, history, holdings] = await Promise.all([
    pool.query(`WITH held AS (
      SELECT stock_item_id,sum(quantity-returned_quantity-transferred_quantity-disposed_quantity)::int AS held_quantity,
        count(DISTINCT user_id)::int AS holders FROM public.employee_accessories WHERE returned_date IS NULL GROUP BY stock_item_id
    ), movement AS (
      SELECT stock_item_id,coalesce(sum(quantity) FILTER(WHERE action IN ('opening','receive')),0)::int AS received_quantity,
        coalesce(sum(quantity) FILTER(WHERE action='dispose'),0)::int AS disposed_quantity
      FROM public.accessory_stock_movements GROUP BY stock_item_id
    ) SELECT s.id::text,s.accessory_type_id::text,t.name AS accessory_type,t.is_active,s.brand,s.model,s.serial_number,
      s.available_quantity,s.version,coalesce(h.held_quantity,0) AS held_quantity,coalesce(h.holders,0) AS holders,
      coalesce(m.received_quantity,0) AS received_quantity,coalesce(m.disposed_quantity,0) AS disposed_quantity
      FROM public.accessory_stock_items s JOIN public.accessory_types t ON t.id=s.accessory_type_id
      LEFT JOIN held h ON h.stock_item_id=s.id LEFT JOIN movement m ON m.stock_item_id=s.id
      ORDER BY t.name,s.brand NULLS FIRST,s.model NULLS FIRST,s.id`),
    pool.query("SELECT id::text,name,is_active FROM public.accessory_types ORDER BY name"),
    pool.query('SELECT id::text,full_name,nickname,employee_code,is_active FROM public."user" WHERE is_active=true ORDER BY full_name'),
    getAccessoryMovements({},pool),
    pool.query(`SELECT ea.stock_item_id::text,ea.user_id::text,u.full_name,u.nickname,u.employee_code,
      sum(ea.quantity-ea.returned_quantity-ea.transferred_quantity-ea.disposed_quantity)::int AS quantity
      FROM public.employee_accessories ea JOIN public."user" u ON u.id=ea.user_id
      WHERE ea.returned_date IS NULL GROUP BY ea.stock_item_id,ea.user_id,u.id ORDER BY u.full_name`),
  ]);
  const items=stocks.rows;
  return { stocks:items,types:types.rows,users:users.rows,holdings:holdings.rows,...history,
    summary:{ available:items.reduce((n,s)=>n+s.available_quantity,0),held:items.reduce((n,s)=>n+s.held_quantity,0),
      disposed:items.reduce((n,s)=>n+s.disposed_quantity,0),received:items.reduce((n,s)=>n+s.received_quantity,0) } };
}

export async function getEmployeeAccessories(userId, pool = getDbPool()) {
  userId=accessoryId(userId,"พนักงาน");
  const [accessories, history, holders] = await Promise.all([
    pool.query(`SELECT ea.*,ea.id::text,ea.user_id::text,ea.stock_item_id::text,ea.accessory_type_id::text,
      ea.issued_date::text,ea.returned_date::text,t.name AS accessory_type,
      CASE WHEN ea.returned_date IS NOT NULL THEN 0 ELSE ea.quantity-ea.returned_quantity-ea.transferred_quantity-ea.disposed_quantity END AS remaining_quantity
      FROM public.employee_accessories ea JOIN public.accessory_types t ON t.id=ea.accessory_type_id
      WHERE ea.user_id=$1 ORDER BY (ea.returned_date IS NOT NULL),ea.id DESC`,[userId]),
    getAccessoryMovements({userId},pool),
    pool.query('SELECT id::text,is_active FROM public."user" WHERE id=$1',[userId]),
  ]);
  return { accessories:accessories.rows,employee:holders.rows[0]??null,...history };
}
