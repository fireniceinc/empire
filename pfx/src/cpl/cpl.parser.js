/**
 * cpl.parser.js
 *
 * Minimal deterministic CPL parser that produces a small AST.
 * No external dependencies. Synchronous and safe for on-device use.
 */

'use strict';

const grammar = require('./cpl.grammar.js');

function tokenize(input) {
  const tokens = [];
  let pos = 0;
  while (pos < input.length) {
    let matched = false;
    for (let i = 0; i < grammar.tokens.length; i += 1) {
      const tk = grammar.tokens[i];
      const m = input.slice(pos).match(tk.pattern);
      if (m && m.index === 0) {
        matched = true;
        if (!tk.ignore) {
          tokens.push({ type: tk.name, text: m[0] });
        }
        pos += m[0].length;
        break;
      }
    }
    if (!matched) {
      // Deterministic error reporting
      throw new Error(`CPL Tokenize error at pos ${pos}: "${input.slice(pos, pos + 20)}"`);
    }
  }
  tokens.push({ type: 'EOF', text: '' });
  return tokens;
}

function parse(input) {
  const tokens = tokenize(input);
  let idx = 0;

  function peek() { return tokens[idx]; }
  function next() { return tokens[idx++]; }
  function expect(type) {
    const t = peek();
    if (t.type !== type) throw new Error(`Expected ${type} but got ${t.type}`);
    return next();
  }

  function parseProgram() {
    const body = [];
    while (peek().type !== 'EOF') {
      body.push(parseStatement());
    }
    return { type: 'Program', body };
  }

  function parseStatement() {
    const expr = parseExpression();
    if (peek().type === 'SEMICOLON') next();
    return { type: 'ExpressionStatement', expression: expr };
  }

  function parseExpression() {
    // Try assignment: IDENT = expression
    const t = peek();
    if (t.type === 'IDENT') {
      const lookahead = tokens[idx + 1] || { type: 'EOF' };
      if (lookahead.type === 'ASSIGN') {
        const left = { type: 'Identifier', name: next().text };
        next(); // consume ASSIGN
        const right = parseExpression();
        return { type: 'Assignment', left, right };
      }
    }
    return parsePrimary();
  }

  function parsePrimary() {
    const t = peek();
    if (t.type === 'NUMBER') {
      next();
      return { type: 'Literal', value: Number(t.text) };
    }
    if (t.type === 'STRING') {
      next();
      // strip quotes deterministically
      const raw = t.text.slice(1, -1).replace(/\\(.)/g, '$1');
      return { type: 'Literal', value: raw };
    }
    if (t.type === 'IDENT') {
      const id = next().text;
      if (peek().type === 'LPAREN') {
        // call
        next(); // LPAREN
        const args = [];
        while (peek().type !== 'RPAREN') {
          args.push(parseExpression());
          if (peek().type === 'COMMA') next();
          else break;
        }
        expect('RPAREN');
        return { type: 'Call', callee: { type: 'Identifier', name: id }, args };
      }
      return { type: 'Identifier', name: id };
    }
    if (t.type === 'LBRACE') {
      return parseObject();
    }
    if (t.type === 'LBRACKET') {
      return parseArray();
    }
    if (t.type === 'LPAREN') {
      next();
      const expr = parseExpression();
      expect('RPAREN');
      return expr;
    }
    throw new Error(`Unexpected token in primary: ${t.type}`);
  }

  function parseObject() {
    expect('LBRACE');
    const pairs = [];
    while (peek().type !== 'RBRACE') {
      const keyTok = peek();
      let key;
      if (keyTok.type === 'STRING') {
        key = next().text.slice(1, -1);
      } else if (keyTok.type === 'IDENT') {
        key = next().text;
      } else {
        throw new Error('Invalid object key: ' + keyTok.type);
      }
      expect('COLON');
      const value = parseExpression();
      pairs.push({ key, value });
      if (peek().type === 'COMMA') next();
      else break;
    }
    expect('RBRACE');
    return { type: 'Object', pairs };
  }

  function parseArray() {
    expect('LBRACKET');
    const elements = [];
    while (peek().type !== 'RBRACKET') {
      elements.push(parseExpression());
      if (peek().type === 'COMMA') next();
      else break;
    }
    expect('RBRACKET');
    return { type: 'Array', elements };
  }

  return parseProgram();
}

module.exports = {
  tokenize,
  parse
};
