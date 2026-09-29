// Parse actual upstream TypeScript; comments cannot fabricate dependencies.
// This validates database contracts, not JWT verification or the HTTP runtime.
import ts from 'typescript';
export function inspectEdge(source, filename) {
  const file = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  if (file.parseDiagnostics.length) throw new Error(`${filename}: TypeScript parse failed`);
  const tables = new Map(), rpcs = [], variables = new Map();
  function visit(node, fn) { fn(node); ts.forEachChild(node, child => visit(child, fn)); }
  visit(file, n => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      const list = variables.get(n.name.text) || [];
      list.push(n); variables.set(n.name.text, list);
    }
  });
  function unwrap(n) {
    while (n && (ts.isParenthesizedExpression(n) || ts.isAsExpression(n) || ts.isNonNullExpression(n))) n = n.expression;
    return n;
  }
  function keys(n, position, seen = new Set()) {
    n = unwrap(n);
    if (ts.isIdentifier(n)) {
      if (seen.has(n.text)) throw new Error(`${filename}: recursive RPC argument ${n.text}`);
      seen.add(n.text);
      const declarations = (variables.get(n.text) || []).filter(d => d.pos < position);
      const declaration = declarations.at(-1);
      if (!declaration) throw new Error(`${filename}: unresolved RPC argument ${n.text}`);
      return keys(declaration.initializer, declaration.pos, seen);
    }
    if (!ts.isObjectLiteralExpression(n)) throw new Error(`${filename}: unsupported RPC argument expression ${n.getText(file)}`);
    return n.properties.flatMap(p => {
      if (ts.isSpreadAssignment(p)) return keys(p.expression, position, new Set(seen));
      if (p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))) return [p.name.text];
      throw new Error(`${filename}: dynamic RPC argument key`);
    });
  }
  const literal = n => n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) ? n.text : null;
  visit(file, node => {
    if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return;
    const method = node.expression.name.text;
    if (method === 'rpc') {
      const name = literal(node.arguments[0]);
      if (!name) throw new Error(`${filename}: dynamic RPC name requires explicit checker support`);
      rpcs.push({name, args: node.arguments[1] ? [...new Set(keys(node.arguments[1], node.pos))] : []});
    }
    if (method !== 'from' || !node.expression.expression.getText(file).endsWith('.database')) return;
    const table = literal(node.arguments[0]);
    if (!table) throw new Error(`${filename}: dynamic database table requires explicit checker support`);
    const fields = tables.get(table) || new Set(); tables.set(table, fields);
    let current = node;
    while (current.parent && ts.isPropertyAccessExpression(current.parent) && current.parent.expression === current
      && ts.isCallExpression(current.parent.parent)) {
      const call = current.parent.parent, op = current.parent.name.text;
      if (['select','eq','neq','gt','gte','lt','lte','is','in','order'].includes(op)) {
        const text = literal(call.arguments[0]);
        if (text === null) throw new Error(`${filename}: dynamic ${op} column requires explicit checker support`);
        for (const col of text.split(',').map(s=>s.trim()).filter(s=>s !== '*')) {
          if (!/^[a-z_][a-z0-9_]*$/.test(col)) throw new Error(`${filename}: complex projection ${col} requires explicit checker support`);
          fields.add(col);
        }
      }
      if (op === 'upsert' && call.arguments[1] && ts.isObjectLiteralExpression(call.arguments[1])) {
        for (const p of call.arguments[1].properties) if (p.name?.getText(file) === 'onConflict') {
          const conflict = literal(p.initializer);
          if (conflict === null) throw new Error(`${filename}: dynamic onConflict`);
          conflict.split(',').forEach(col => fields.add(col.trim()));
        }
      }
      current = call;
    }
  });
  return {tables, rpcs};
}
