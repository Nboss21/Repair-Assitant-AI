import { Request, Response } from "express";
import { getDb } from "../db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
// uuidv4 is handled by database default, but we can generate it here too if we want.
// Postgres gen_random_uuid() handles it, but let's stick to consistent manual generation if needed, 
// OR just rely on the DB. Let's rely on the DB if possible, but for 'id' returning, 
// we might need to INSERT ... RETURNING id.

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

export const signup = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const db = getDb(); // this is a Pool
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Postgres insert
    const result = await db.query(
      "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email, created_at",
      [email, hashedPassword]
    );

    const user = result.rows[0];
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: "24h" });
    res.json({ token, user });
  } catch (error: any) {
    console.error("Signup error:", error);
    if (error.code === "23505") { // Unique constraint violation code in Postgres
      return res.status(400).json({ error: "Email already exists" });
    }
    res.status(500).json({ error: "Error creating user: " + error.message });
  }
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  console.log("Login attempt for:", email);

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const db = getDb();
    const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
    const user = result.rows[0];
    
    console.log("User found:", !!user);

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: "24h",
    });
    res.json({ token, user: { id: user.id, email: user.email } });
  } catch (error: any) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Error logging in: " + error.message });
  }
};
