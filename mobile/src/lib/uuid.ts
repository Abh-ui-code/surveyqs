/**
 * A client-generated id, not a security token — collision probability
 * across one agent's interviews is negligible, and the server rejects
 * duplicates via its own unique constraint anyway. Every `client_ref_id`
 * sent to the backend (respondent, consent, response, attachment) is a
 * real database UUIDField, so this must produce an actual UUID string,
 * not a short chain token like "r1" — sending "r1" as client_ref_id is
 * exactly what crashed the sync batch endpoint with a 500 before this
 * existed.
 */
export function newUuid(): string {
  const hex = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < 36; i += 1) {
    if (i === 8 || i === 13 || i === 18 || i === 23) out += "-";
    else if (i === 14) out += "4";
    else if (i === 19) out += hex[8 + Math.floor(Math.random() * 4)]; // variant bits 10xx
    else out += hex[Math.floor(Math.random() * 16)];
  }
  return out;
}
