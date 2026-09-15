// Explicit allowlist, verified against PostgreSQL; no client-supplied SQL identifiers.
export const masterConfig = {
  departments: { label: "Departments", fields: { name: 150, department_code: 50 } },
  locations: { label: "Locations", fields: { name: 150, building: 100, floor: 50, room: 100, description: 10000 } },
  vendors: { label: "Vendors", fields: { name: 200, contact_name: 200, phone: 50, email: 255, address: 10000, notes: 10000 } },
};
