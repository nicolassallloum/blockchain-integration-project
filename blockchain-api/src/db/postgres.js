'use strict';

const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.PGHOST || '172.31.13.133',
    port: Number(process.env.PGPORT || 5444),
    database: process.env.PGDATABASE || 'vfds_dev',
    user: process.env.PGUSER || 'pgdata',
    password: process.env.PGPASSWORD || 'pgdata@Valoores05',
    max: 10,
    idleTimeoutMillis: 30000
});

module.exports = pool;
