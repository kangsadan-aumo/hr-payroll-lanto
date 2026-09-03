const mysql = require('mysql2/promise');

async function createDB() {
    try {
        const conn = await mysql.createConnection({ host: 'localhost', user: 'root', password: '' });
        await conn.query("CREATE DATABASE IF NOT EXISTS `hr-payroll-db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;");
        console.log('Database created successfully!');
        await conn.end();
    } catch (err) {
        console.error(err.message);
    }
}
createDB();
