/**
 * The envelope around everything the app stores (STOR-1, STOR-2): `{version, data}`. Reading one
 * applies the migrations in order, never changes the stored value, and never throws.
 */

export const wrap = (version, data) => ({ version, data });

/**
 * @param {unknown} value what was found in storage
 * @param {{version: number, migrations?: Object<number, (data: any) => any>}} options the
 *   current schema version and the steps from version n to n + 1
 * @returns {{status: 'empty' | 'ok' | 'migrated' | 'newer' | 'invalid' | 'failed',
 *   data: any, version?: number, error?: string}} `data` is null unless the status is ok or
 *   migrated. `newer` means a later app wrote it: leave it alone.
 */
export function unwrap(value, { version, migrations = {} }) {
  if (value === null || value === undefined) return { status: 'empty', data: null };
  const found = value?.version;
  const valid =
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Number.isInteger(found) &&
    found >= 1 &&
    'data' in value;
  if (!valid) return { status: 'invalid', data: null };
  if (found > version) return { status: 'newer', data: null, version: found };
  if (found === version) return { status: 'ok', data: value.data };

  let data = structuredClone(value.data);
  for (let from = found; from < version; from += 1) {
    const step = migrations[from];
    if (!step) return { status: 'failed', data: null, error: `no migration from version ${from}` };
    try {
      data = step(data);
    } catch (error) {
      return { status: 'failed', data: null, error: String(error.message ?? error) };
    }
  }
  return { status: 'migrated', data };
}
