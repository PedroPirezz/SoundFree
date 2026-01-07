const { DataTypes } = require('sequelize');
const sequelize = require('../model/index'); // importa a instância do Sequelize

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  }
}, {
  tableName: 'users', // Nome da tabela no banco
  timestamps: false   // Defina como `true` se a tabela tiver colunas `createdAt` e `updatedAt`
});

User.sync({ force: false }).then(() => {
  console.log("Users table connected with success")
})

module.exports = User;
