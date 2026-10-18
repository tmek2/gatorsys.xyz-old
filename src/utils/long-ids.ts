/**
 * JSON with every integer too long for a JavaScript number written as a
 * string instead, outside strings only. A Discord id is 17 to 19 digits and a
 * JavaScript number holds 15 to 16 exactly: parsed as a number it is rounded
 * to a different id, which then gets saved back as the wrong channel or the
 * wrong member.
 */
export function quoteLongIntegers(raw: string, digits = 16): string {
  let out = "";
  let inString = false;
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    if (inString) {
      out += char;
      if (char === "\\") {
        out += raw[index + 1] ?? "";
        index += 1;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      out += char;
      continue;
    }
    if (char === "-" || (char >= "0" && char <= "9")) {
      let end = index + (char === "-" ? 1 : 0);
      while (end < raw.length && raw[end] >= "0" && raw[end] <= "9") end += 1;
      const whole = raw[end] !== "." && raw[end] !== "e" && raw[end] !== "E";
      const length = end - index - (char === "-" ? 1 : 0);
      // Consume the complete JSON number. Treating the fraction or exponent as
      // a second integer could insert quotes into an otherwise valid number.
      if (raw[end] === ".") {
        end += 1;
        while (end < raw.length && raw[end] >= "0" && raw[end] <= "9") end += 1;
      }
      if (raw[end] === "e" || raw[end] === "E") {
        end += 1;
        if (raw[end] === "+" || raw[end] === "-") end += 1;
        while (end < raw.length && raw[end] >= "0" && raw[end] <= "9") end += 1;
      }
      const number = raw.slice(index, end);
      out += whole && length >= digits ? `"${number}"` : number;
      index = end - 1;
      continue;
    }
    out += char;
  }
  return out;
}
