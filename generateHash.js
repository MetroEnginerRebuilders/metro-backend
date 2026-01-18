const bcrypt = require('bcryptjs');

const password = 'admin';
const hashedPassword = bcrypt.hashSync(password, 10);

console.log('Hashed password for "admin":');
console.log(hashedPassword);
console.log('\nSQL Query:');
console.log(`INSERT INTO users (username, password) VALUES ('admin', '${hashedPassword}');`);
