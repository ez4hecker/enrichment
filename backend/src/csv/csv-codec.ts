export function parseCsv(csv: string): Array<Array<string>> {
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

  if (inQuotedField) {
    throw new Error("CSV contains an unterminated quoted field");
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

export function serializeCsv(rows: Array<Array<string>>): string {
  return `${rows.map((row) => row.map(serializeField).join(",")).join("\n")}\n`;
}

export function isEmptyCsvRow(row: Array<string>): boolean {
  return row.every((field) => field.trim() === "");
}

function serializeField(value: string): string {
  if (!/[",\r\n]/.test(value)) {
    return value;
  }

  return `"${value.replaceAll('"', '""')}"`;
}
