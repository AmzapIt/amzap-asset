-- =========================================================
-- 20. Employee Accessories
--
-- ใช้สำหรับอุปกรณ์ที่ไม่ต้องมี Asset Code เช่น
-- Mouse / Keyboard / Headset / Charger / Webcam / Dock
-- =========================================================


-- =========================================================
-- 1. Master ประเภทอุปกรณ์
-- =========================================================
CREATE TABLE IF NOT EXISTS public.accessory_types (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name varchar(150) NOT NULL UNIQUE,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);


-- =========================================================
-- 2. อุปกรณ์ที่มอบให้พนักงาน
-- =========================================================
CREATE TABLE IF NOT EXISTS public.employee_accessories (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    -- พนักงาน
    user_id bigint NOT NULL
        REFERENCES public."user"(id),

    -- ประเภท เช่น Mouse / Keyboard
    accessory_type_id bigint NOT NULL
        REFERENCES public.accessory_types(id),

    -- จำนวนที่มอบ
    quantity integer NOT NULL DEFAULT 1
        CHECK (quantity > 0),

    brand varchar(150),
    model varchar(150),
    serial_number varchar(200),

    -- วันที่มอบ
    issued_date date NOT NULL DEFAULT CURRENT_DATE,

    -- ถ้า NULL = ยังถืออยู่
    -- ถ้ามีวันที่ = คืนแล้ว
    returned_date date,

    notes text,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CHECK (
        returned_date IS NULL
        OR returned_date >= issued_date
    )
);


-- =========================================================
-- Index
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_employee_accessories_user
ON public.employee_accessories(user_id);

CREATE INDEX IF NOT EXISTS idx_employee_accessories_type
ON public.employee_accessories(accessory_type_id);

CREATE INDEX IF NOT EXISTS idx_employee_accessories_current
ON public.employee_accessories(user_id)
WHERE returned_date IS NULL;


-- =========================================================
-- Master เริ่มต้น
-- =========================================================
INSERT INTO public.accessory_types (name)
VALUES
    ('Mouse'),
    ('Keyboard'),
    ('Headset'),
    ('Webcam'),
    ('Notebook Charger'),
    ('Docking Station'),
    ('USB Hub'),
    ('Bag'),
    ('HDMI Cable'),
    ('LAN Cable')
ON CONFLICT (name) DO NOTHING;