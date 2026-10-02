export function searchEmployees(users, searchText) {
  const terms = String(searchText).trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return users;

  return users.filter((user) => {
    const searchableText = [user.employee_code, user.full_name, user.nickname]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return terms.every((term) => searchableText.includes(term));
  });
}
