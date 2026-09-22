import { query } from "./db.js";

// Quantity is summed because one issue record may contain more than one item.
// These numbers describe issued/returned accessories, not warehouse stock.
export async function getAccessorySummary() {
  const result = await query(`
    WITH type_summary AS (
      SELECT
        at.id::text AS id,
        at.name,
        at.is_active,
        COUNT(ea.id)::int AS issue_records,
        COALESCE(SUM(ea.quantity), 0)::int AS issued_quantity,
        COALESCE(SUM(ea.quantity) FILTER (
          WHERE ea.returned_date IS NULL
        ), 0)::int AS current_quantity,
        COALESCE(SUM(ea.quantity) FILTER (
          WHERE ea.returned_date IS NOT NULL
        ), 0)::int AS returned_quantity,
        COUNT(DISTINCT ea.user_id) FILTER (
          WHERE ea.returned_date IS NULL
        )::int AS current_employees
      FROM public.accessory_types at
      LEFT JOIN public.employee_accessories ea
        ON ea.accessory_type_id = at.id
      GROUP BY at.id, at.name, at.is_active
    ), holder_summary AS (
      SELECT
        u.id::text AS id,
        u.employee_code,
        u.full_name,
        SUM(ea.quantity)::int AS current_quantity,
        COUNT(ea.id)::int AS issue_records,
        STRING_AGG(DISTINCT at.name, ', ' ORDER BY at.name) AS accessory_types
      FROM public.employee_accessories ea
      INNER JOIN public."user" u
        ON u.id = ea.user_id
      INNER JOIN public.accessory_types at
        ON at.id = ea.accessory_type_id
      WHERE ea.returned_date IS NULL
      GROUP BY u.id, u.employee_code, u.full_name
    )
    SELECT jsonb_build_object(
      'issuedQuantity', COALESCE((
        SELECT SUM(issued_quantity) FROM type_summary
      ), 0),
      'currentQuantity', COALESCE((
        SELECT SUM(current_quantity) FROM type_summary
      ), 0),
      'returnedQuantity', COALESCE((
        SELECT SUM(returned_quantity) FROM type_summary
      ), 0),
      'issueRecords', COALESCE((
        SELECT SUM(issue_records) FROM type_summary
      ), 0),
      'currentEmployees', (SELECT COUNT(*) FROM holder_summary),
      'types', COALESCE((
        SELECT jsonb_agg(to_jsonb(t) ORDER BY current_quantity DESC, name, id)
        FROM type_summary t
      ), '[]'::jsonb),
      'holders', COALESCE((
        SELECT jsonb_agg(to_jsonb(h) ORDER BY current_quantity DESC, full_name, id)
        FROM holder_summary h
      ), '[]'::jsonb)
    ) AS summary
  `);

  return result.rows[0].summary;
}
