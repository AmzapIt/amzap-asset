export function reportCsv(rows, columns) {
  const cell = (value) => {
    let text = String(value ?? "");
    if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return `\uFEFF${[
    columns.map((column) => cell(column.label)).join(","),
    ...rows.map((row) => columns.map((column) => cell(row[column.key])).join(",")),
  ].join("\r\n")}`;
}
