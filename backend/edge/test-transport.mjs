// TEST ONLY: a strict subset of the InsForge/PostgREST HTTP contract.
// Actual @insforge/sdk serializes requests; actual PostgreSQL executes all SQL.
// No network, stubbed RPC results, extra tables, or permissive unknown routes.
export async function localTransport(db, serviceToken) {
  const trace = [], failures = new Map();
  const identifier = value => {
    if (!/^[a-z_][a-z0-9_]*$/.test(value)) throw new Error(`Unsupported identifier: ${value}`);
    return `"${value}"`;
  };
  const catalog = (await db.query(`SELECT p.proname,p.proargnames,oidvectortypes(p.proargtypes) AS types
    FROM pg_proc p WHERE p.pronamespace='public'::regnamespace`)).rows;
  const response = (body,status=200,headers={}) => new Response(body === null ? null : JSON.stringify(body),
    {status,headers:{'Content-Type':'application/json',...headers}});
  async function fetch(input,init = {}) {
    const url = new URL(String(input)), method = init.method || 'GET', headers = new Headers(init.headers);
    if (url.origin !== 'https://bootstrap.test') throw new Error('Test transport forbids external hosts');
    if (headers.get('Authorization') !== `Bearer ${serviceToken}`) return response({message:'Test service role required'},401);
    const route = url.pathname.match(/^\/api\/database\/(records|rpc)\/([a-z_][a-z0-9_]*)$/);
    if (!route) throw new Error(`Unsupported test route: ${url.pathname}`);
    const [,kind,name] = route; trace.push({kind,name,method});
    if (failures.has(name)) return response({message:failures.get(name),code:'TEST_FAILURE'},500);
    try {
      const args = [], param = value => {args.push(value);return `$${args.length}`;};
      if (kind === 'rpc') {
        if (method !== 'POST') throw new Error('RPC test transport requires POST');
        const spec = catalog.find(f=>f.proname===name);
        if (!spec) throw new Error(`Missing actual RPC ${name}`);
        const body = JSON.parse(init.body || '{}'), types = spec.types ? spec.types.split(', ') : [];
        const named = Object.entries(body).map(([key,value])=>{
          const index = spec.proargnames?.indexOf(key);
          if (index === undefined || index < 0) throw new Error(`Unknown RPC parameter ${key}`);
          if (Array.isArray(value) && types[index]==='uuid[]') value = `{${value.join(',')}}`;
          else if (types[index]==='jsonb') value = JSON.stringify(value);
          return `${identifier(key)} := ${param(value)}::${types[index]}`;
        });
        const result = await db.query(`SELECT public.${identifier(name)}(${named.join(',')}) AS value`,args);
        return response(result.rows[0].value);
      }
      const table = `public.${identifier(name)}`, prefer = headers.get('Prefer') || '';
      const columns = url.searchParams.get('select') || '*';
      const projection = columns==='*' ? '*' : columns.split(',').map(identifier).join(',');
      const filters = [];
      for (const [field,encoded] of url.searchParams) {
        if (['select','on_conflict','columns','order','limit','offset'].includes(field)) continue;
        const dot = encoded.indexOf('.'), op = encoded.slice(0,dot), val = encoded.slice(dot+1), col = identifier(field);
        if (op === 'is' && val === 'null') filters.push(`${col} IS NULL`);
        else if (op === 'in') {
          if (!val.startsWith('(') || !val.endsWith(')')) throw new Error('Invalid in filter');
          filters.push(`${col} IN (${val.slice(1,-1).split(',').map(s=>param(s.replace(/^"|"$/g,''))).join(',')})`);
        } else if (['eq','neq','gt','gte','lt','lte'].includes(op)) {
          const operators = {eq:'=',neq:'<>',gt:'>',gte:'>=',lt:'<',lte:'<='};
          filters.push(`${col} ${operators[op]} ${param(val)}`);
        } else throw new Error(`Unsupported test filter: ${encoded}`);
      }
      const where = filters.length ? ` WHERE ${filters.join(' AND ')}` : '';
      let sql;
      if (method === 'GET') {
        sql = `SELECT ${projection} FROM ${table}${where}`;
        if (url.searchParams.has('order')) sql += ' ORDER BY '+url.searchParams.get('order').split(',').map(v=>{
          const [col,direction] = v.split('.');
          if (!['asc','desc'].includes(direction)) throw new Error('Unsupported order');
          return `${identifier(col)} ${direction}`;
        }).join(',');
        for (const op of ['limit','offset']) if (url.searchParams.has(op)) {
          const value = Number(url.searchParams.get(op));
          if (!Number.isInteger(value) || value<0) throw new Error('Invalid pagination');
          sql += ` ${op.toUpperCase()} ${value}`;
        }
      } else if (method === 'DELETE') sql = `DELETE FROM ${table}${where} RETURNING ${projection}`;
      else if (method === 'PATCH') {
        const body = JSON.parse(init.body);
        sql = `UPDATE ${table} SET ${Object.entries(body).map(([k,v])=>`${identifier(k)}=${param(v)}`).join(',')}${where} RETURNING ${projection}`;
      } else if (method === 'POST') {
        const body = JSON.parse(init.body), rows = Array.isArray(body) ? body : [body];
        if (!rows.length) return response([]);
        const fields = Object.keys(rows[0]);
        for (const row of rows) if (Object.keys(row).join(',') !== fields.join(',')) throw new Error('Mixed insert shapes unsupported in test transport');
        sql = `INSERT INTO ${table} (${fields.map(identifier).join(',')}) VALUES `+
          rows.map(row=>'('+fields.map(f=>param(row[f])).join(',')+')').join(',');
        if (prefer.includes('resolution=ignore-duplicates')) sql += ' ON CONFLICT DO NOTHING';
        else if (prefer.includes('resolution=merge-duplicates')) {
          const conflict = (url.searchParams.get('on_conflict') || 'id').split(',');
          const updates = fields.filter(f=>!conflict.includes(f)).map(f=>`${identifier(f)}=EXCLUDED.${identifier(f)}`);
          sql += ` ON CONFLICT (${conflict.map(identifier).join(',')}) DO UPDATE SET ${updates.join(',')}`;
        }
        sql += ` RETURNING ${projection}`;
      } else throw new Error(`Unsupported test method ${method}`);
      // Serialize REST rows in PostgreSQL, as a PostgREST JSON response does.
      // Raw node-postgres returns int8 as strings; that is a driver policy, not
      // the JSON wire representation. Keep strict request assertions unchanged.
      const wire = await db.query(`WITH response_rows AS (${sql}) SELECT row_to_json(response_rows) AS payload FROM response_rows`,args);
      const result = {rows:wire.rows.map(row=>row.payload)};
      const single = (headers.get('Accept') || '').includes('vnd.pgrst.object');
      if (single && result.rows.length !== 1) return response({message:'JSON object requested, multiple (or no) rows returned',details:`The result contains ${result.rows.length} rows`,code:'PGRST116'},406);
      const extra = {};
      if (prefer.includes('count=exact')) {
        const count = (await db.query(`SELECT count(*)::int AS n FROM ${table}${where}`,args)).rows[0].n;
        extra['Content-Range'] = `0-${Math.max(result.rows.length-1,0)}/${count}`;
      }
      return response(single ? result.rows[0] : result.rows,200,extra);
    } catch (error) { return response({message:error.message,code:error.code || 'LOCAL_CONTRACT_ERROR'},400); }
  }
  return {fetch,trace,failures};
}
