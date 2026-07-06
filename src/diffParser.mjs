export function parseUnifiedDiff(diffText) {
  const text = String(diffText ?? "");
  const files = [];
  let current = null;
  let oldLine = 0;
  let newLine = 0;

  function ensureFile(path = "<diff>") {
    if (!current) {
      current = { file: path, added: [], removed: [], hunks: [] };
      files.push(current);
    }
    return current;
  }

  for (const rawLine of text.split(/\r?\n/)) {
    if (rawLine.startsWith("diff --git ")) {
      current = null;
      oldLine = 0;
      newLine = 0;
      continue;
    }
    if (rawLine.startsWith("+++ b/")) {
      const path = rawLine.slice("+++ b/".length);
      current = { file: path, added: [], removed: [], hunks: [] };
      files.push(current);
      continue;
    }
    if (rawLine.startsWith("+++ ") && rawLine !== "+++ /dev/null") {
      const path = rawLine.replace(/^\+\+\+\s+/, "").replace(/^b\//, "");
      current = { file: path, added: [], removed: [], hunks: [] };
      files.push(current);
      continue;
    }
    if (rawLine.startsWith("@@")) {
      const match = rawLine.match(/@@\s+-(\d+)(?:,\d+)?\s+\+(\d+)(?:,\d+)?/);
      if (match) {
        oldLine = Number(match[1]);
        newLine = Number(match[2]);
        ensureFile().hunks.push(rawLine);
      }
      continue;
    }
    if (!current && (rawLine.startsWith("+") || rawLine.startsWith("-") || rawLine.startsWith(" "))) {
      ensureFile();
    }
    if (!current) continue;

    if (rawLine.startsWith("+") && !rawLine.startsWith("+++")) {
      current.added.push({
        file: current.file,
        line: newLine || 1,
        text: rawLine.slice(1),
        raw: rawLine
      });
      newLine += 1;
      continue;
    }
    if (rawLine.startsWith("-") && !rawLine.startsWith("---")) {
      current.removed.push({
        file: current.file,
        line: oldLine || 1,
        text: rawLine.slice(1),
        raw: rawLine
      });
      oldLine += 1;
      continue;
    }
    if (rawLine.startsWith(" ")) {
      oldLine += 1;
      newLine += 1;
    }
  }

  return files.filter((file) => file.added.length || file.removed.length || file.hunks.length);
}

export function addedLines(files) {
  return files.flatMap((file) => file.added);
}

export function changedFileCount(files) {
  return files.filter((file) => file.added.length || file.removed.length).length;
}
