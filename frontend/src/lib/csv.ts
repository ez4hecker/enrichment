// Backend-compatible CSV parsing to ensure header names match exactly.
export function parseCsvText(csv: string): string[][] {
  const rows: Array<Array<string>> = [];
  let row: Array<string> = [];
  let field = "";
  let inQuotedField = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    const nextCharacter = csv[index + 1];

    if (inQuotedField) {
      if (character === '"' && nextCharacter === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        inQuotedField = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"' && field === "") {
      inQuotedField = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (character !== "\r") {
      field += character;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

export function csvLine(fields: string[]) {
  return fields.map(f => /[",\r\n]/.test(f) ? `"${f.replace(/"/g, '""')}"` : f).join(",");
}
