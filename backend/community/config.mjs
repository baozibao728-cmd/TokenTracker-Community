// Trusted server configuration. The future Edge caller supplies Deno.env.get;
// tests inject an environment reader. Never accept these values from HTTP input.
/** @typedef {{max_owned:number,max_joined:number,max_members:number}} CommunityLimits */
/** @type {Readonly<CommunityLimits>} */
const defaults = Object.freeze({ max_owned: 10, max_joined: 20, max_members: 2000 });
/** @param {(name:string)=>string|undefined} getEnv @returns {Readonly<CommunityLimits>} */
export function readCommunityLimits(getEnv) {
  if (typeof getEnv !== 'function') throw new TypeError('An environment reader is required');
  const limits = { ...defaults };
  /** @type {(keyof CommunityLimits)[]} */
  const fields = ['max_owned','max_joined','max_members'];
  for (const field of fields) {
    const fallback = defaults[field];
    const name = `COMMUNITY_${field.toUpperCase()}`;
    const raw = getEnv(name);
    if (raw === undefined) { limits[field] = fallback; continue; }
    if (typeof raw !== 'string' || !/^[1-9]\d*$/.test(raw.trim())) throw new Error(`Invalid ${name}: expected a positive integer`);
    const value = Number(raw.trim());
    if (!Number.isSafeInteger(value) || value > 2147483647) throw new Error(`Invalid ${name}: exceeds PostgreSQL integer range`);
    limits[field] = value;
  }
  return Object.freeze(limits);
}
