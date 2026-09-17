// =========================================================
// Master Data Configuration
//
// ใช้เป็น Allowlist ของ Master ที่ระบบอนุญาต
// ไม่รับชื่อ table จาก client โดยตรง
// =========================================================

export const masterConfig = {
  departments: {
    label: "Departments",

    fields: {
      name: 150,
      department_code: 50,
    },

    listFields: [
      { key: "department_code", label: "Code" },
      { key: "name", label: "Department Name" },
    ],
  },

  locations: {
    label: "Locations",

    fields: {
      name: 150,
      building: 100,
      floor: 50,
      room: 100,
      description: 10000,
    },

    listFields: [
      { key: "name", label: "Location" },
      { key: "building", label: "Building" },
      { key: "floor", label: "Floor" },
      { key: "room", label: "Room" },
    ],
  },

  vendors: {
    label: "Vendors",

    fields: {
      name: 200,
      contact_name: 200,
      phone: 50,
      email: 255,
      address: 10000,
      notes: 10000,
    },

    listFields: [
      { key: "name", label: "Vendor" },
      { key: "contact_name", label: "Contact" },
      { key: "phone", label: "Phone" },
      { key: "email", label: "Email" },
    ],
  },

  // =======================================================
  // Asset Types
  //
  // prefix ใช้สร้าง Asset Code
  // เช่น:
  // Notebook -> NB
  // Monitor  -> MON
  // =======================================================
  asset_types: {
    label: "Asset Types",

    fields: {
      name: 150,
      prefix: 10,
    },

    listFields: [
      { key: "name", label: "Asset Type" },
      { key: "prefix", label: "Prefix" },
    ],
  },
};