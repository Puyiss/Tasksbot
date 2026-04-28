const { Sequelize } = require('sequelize');

// Configuración de la base de datos
const sequelize = new Sequelize(
    process.env.DB_NAME || 'tasksbot',
    process.env.DB_USER || 'root',
    process.env.DB_PASSWORD || '',
    {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        dialect: 'mysql',
        logging: process.env.NODE_ENV === 'development' ? console.log : false,
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        },
        // Configuración para reconexión automática
        retry: {
            max: 3
        }
    }
);

// Función para probar conexión
async function testConnection() {
    try {
        await sequelize.authenticate();
        console.log('✅ Conexión a la base de datos exitosa');
        return true;
    } catch (error) {
        console.error('❌ Error conectando a la base de datos:', error.message);
        console.log('⚠️  Usando archivos JSON como fallback');
        return false;
    }
}

// Función para sincronizar modelos
async function syncDatabase() {
    try {
        await sequelize.sync({ alter: true });
        console.log('✅ Base de datos sincronizada');
    } catch (error) {
        console.error('❌ Error sincronizando base de datos:', error);
    }
}

module.exports = {
    sequelize,
    testConnection,
    syncDatabase
};
