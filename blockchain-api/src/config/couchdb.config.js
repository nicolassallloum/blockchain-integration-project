require('dotenv').config();

const couchdbConfig = {
  url: process.env.COUCHDB_URL || 'http://127.0.0.1:5984',
  username: process.env.COUCHDB_USERNAME || 'admin',
  password: process.env.COUCHDB_PASSWORD || 'adminpw',
};

console.log('[COUCHDB CONFIG]', {
  url: couchdbConfig.url,
  username: couchdbConfig.username,
  passwordLoaded: Boolean(couchdbConfig.password),
});

module.exports = couchdbConfig;