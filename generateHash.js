const bcrypt = require('bcryptjs');

const username = 'admin';
const plainPassword = 'admin1';
const saltRounds = 10;

const hashedPassword = bcrypt.hashSync(plainPassword, saltRounds);

console.log(`Username: ${username}`);
console.log(`Plain password: ${plainPassword}`);
console.log('Hashed password:');
console.log(hashedPassword);

console.log('\nSQL Query (insert or update if username exists):');
console.log(
	`INSERT INTO users (username, password) VALUES ('${username}', '${hashedPassword}') ` +
		`ON CONFLICT (username) DO UPDATE SET password = EXCLUDED.password, updated_at = CURRENT_TIMESTAMP;`
);
