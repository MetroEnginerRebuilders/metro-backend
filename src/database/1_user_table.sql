-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on username for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);


-- INSERT INTO users (username, password)
-- VALUES (
--   'admin',
--   '$2b$10$a7Cpy6kTGToyaKu8ZZddvOrI7NGraB8ltGFfj5ibk7LrImpTTrKIm'
-- )
-- ON CONFLICT (username)
-- DO UPDATE SET
--   password = EXCLUDED.password,
--   updated_at = CURRENT_TIMESTAMP;