/**
 * Configuración de PostgreSQL - Sistema de Comandas
 */
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
    process.env.DB_NAME || 'restaurant_pos',
    process.env.DB_USER || 'postgres',
    process.env.DB_PASSWORD || 'postgres',
    {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        dialect: 'postgres',
        logging: process.env.NODE_ENV === 'development' ? console.log : false,
        pool: {
            max: 10,
            min: 0,
            acquire: 30000,
            idle: 10000
        },
        define: {
            timestamps: true,
            underscored: true
        }
    }
);

const testConnection = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ PostgreSQL conectado');
        return true;
    } catch (error) {
        console.error('❌ Error PostgreSQL:', error.message);
        return false;
    }
};

const syncDatabase = async (force = false) => {
    await sequelize.sync({ force });
    console.log('✅ Modelos sincronizados');
};

module.exports = { sequelize, testConnection, syncDatabase, Sequelize };
