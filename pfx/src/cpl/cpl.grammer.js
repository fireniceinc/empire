/**
 * cpl.grammar.js
 *
 * Compact CPL grammar used by the CPL runtime and parser.
 * Deterministic, minimal, and suitable for on-device use.
 */

'use strict';

const CPLGrammar = {
  meta: {
    name: 'CPL',
    version: '2026-08-10'
  },

  // Token definitions (order matters for deterministic matching)
  tokens: [
    { name: 'WHITESPACE', pattern: /^\s+/, ignore: true },
    { name: 'NUMBER', pattern: /^\d+(\.\d+)?/ },
    { name: 'STRING', pattern: /^"([^"\\]|\\.)*"/ },
    { name: 'IDENT', pattern: /^[A-Za-z_][A-Za-z0-9_]*/ },
    { name: 'ARROW', pattern: /^=>/ },
    { name: 'ASSIGN', pattern: /^=/ },
    { name: 'COMMA', pattern: /^,/ },
    { name: 'COLON', pattern: /^:/ },
    { name: 'SEMICOLON', pattern: /^;/ },
    { name: 'LPAREN', pattern: /^\(/ },
    { name: 'RPAREN', pattern: /^\)/ },
    { name: 'LBRACE', pattern: /^\{/ },
    { name: 'RBRACE', pattern: /^\}/ },
    { name: 'LBRACKET', pattern: /^\[/ },
    { name: 'RBRACKET', pattern: /^\]/ },
    { name: 'OP', pattern: /^[+\-*/%]/ }
  ],

  // High-level AST node types
  nodes: {
    Program: { type: 'Program', fields: ['body'] },
    ExpressionStatement: { type: 'ExpressionStatement', fields: ['expression'] },
    Assignment: { type: 'Assignment', fields: ['left', 'right'] },
    Call: { type: 'Call', fields: ['callee', 'args'] },
    Identifier: { type: 'Identifier', fields: ['name'] },
    Literal: { type: 'Literal', fields: ['value'] },
    Object: { type: 'Object', fields: ['pairs'] },
    Array: { type: 'Array', fields: ['elements'] },
    Function: { type: 'Function', fields: ['params', 'body'] }
  },

  // Minimal helper to recognize punctuation tokens
  punctuation: ['COMMA', 'COLON', 'SEMICOLON', 'LPAREN', 'RPAREN', 'LBRACE', 'RBRACE', 'LBRACKET', 'RBRACKET']
};

module.exports = CPLGrammar;
