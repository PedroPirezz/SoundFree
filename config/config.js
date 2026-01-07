module.exports = {
  development: {
    username: 'postgres',
    password: '3H9iuRFyTNLuFUm9',
    database: 'cuidadoso',
    host: 'manfully-paternal-panda.data-1.use1.tembo.io',
    port: 5432,
    dialect: 'postgres',
    dialectModule: require('pg'),
    dialectOptions: {
      ssl: {
        require: false, // ou true se necessário
        rejectUnauthorized: false
      }
    }
  }
};
