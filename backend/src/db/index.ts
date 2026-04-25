import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

let pool: Pool;

export const getDb = () => {
    if (!pool) {
        if (!process.env.DATABASE_URL) {
            console.error("❌ DATABASE_URL is missing in .env file.");
            console.error("Please add it: DATABASE_URL=postgresql://user:password@localhost:5432/dbname");
            throw new Error("DATABASE_URL must be set in Environment Variables");
        }

        console.log("Initializing Postgres connection pool...");
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });

        // Test connection
        pool.query('SELECT NOW()', (err, res) => {
            if (err) {
                console.error('Error connecting to PostgreSQL:', err);
            } else {
                console.log('Connected to PostgreSQL at:', res.rows[0].now);
                // initDb is now called explicitly in index.ts
            }
        });
    }
    return pool;
};

// Initialize tables
export const initDb = async () => {
    const db = getDb();
    console.log("Initializing DB schema...");
    const client = await db.connect();
    try {
        await client.query('BEGIN');

        console.log("Creating users table...");
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log("Creating conversations table...");
        await client.query(`
            CREATE TABLE IF NOT EXISTS conversations (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES users(id),
                thread_id TEXT UNIQUE NOT NULL,
                title TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log("Creating token_usage table...");
        await client.query(`
            CREATE TABLE IF NOT EXISTS token_usage (
                id SERIAL PRIMARY KEY,
                user_id UUID NOT NULL REFERENCES users(id),
                thread_id TEXT NOT NULL,
                input_tokens INTEGER NOT NULL,
                output_tokens INTEGER NOT NULL,
                total_tokens INTEGER NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log("Creating indexes...");
        await client.query(`CREATE INDEX IF NOT EXISTS idx_token_usage_user_id ON token_usage(user_id);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_token_usage_thread_id ON token_usage(thread_id);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);`);

        await client.query('COMMIT');
        console.log("DB Initialization complete.");
    } catch (e) {
        await client.query('ROLLBACK');
        console.error("Error initializing DB schema:", e);
        throw e;
    } finally {
        client.release();
    }
};

export default getDb;
