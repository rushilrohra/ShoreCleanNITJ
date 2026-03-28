/**
 * db-query.js — thin adapter so code using `const { query } = require('./db-query')`
 * works the same as our main `pool.query()`.
 */
const pool = require('./database');

const query = (text, params) => pool.query(text, params);

module.exports = { pool, query };
