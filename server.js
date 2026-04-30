Set-Content C:\xampp\htdocs\facerecognition\server.js @'
if (process.env.NODE_ENV !== "production") require("dotenv").config();
const express = require("express");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const path = require("path");
const QRCode = require("qrcode");

const app = express();
app.use(express.json());
app.use(express.static("public"));
app.use("/models", express.static(path.join(__dirname, "models")));

const db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

db.connect()
    .then(() => console.log("Supabase PostgreSQL Connected!"))
    .catch(err => console.error("DB CONNECTION ERROR:", err.message));

app.post("/register", async (req, res) => {
    const { username, password, faceData } = req.body;
    if (!username || !password || !faceData) return res.json({ success: false, message: "Missing data" });
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await db.query(
            "INSERT INTO face_users (username, password, face_data) VALUES ($1, $2, $3) RETURNING id",
            [username, hashedPassword, JSON.stringify(faceData)]
        );
        const insertId = result.rows[0].id;
        const qrImage = await QRCode.toDataURL(`${insertId}-${username}`, { width: 300, margin: 2 });
        res.json({ success: true, qrCode: qrImage, userId: insertId });
    } catch (error) {
        res.json({ success: false, message: "Username already exists" });
    }
});

app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.json({ success: false });
    try {
        const result = await db.query("SELECT * FROM face_users WHERE username = $1", [username]);
        if (result.rows.length === 0) return res.json({ success: false });
        const match = await bcrypt.compare(password, result.rows[0].password);
        res.json({ success: match });
    } catch (err) {
        res.json({ success: false });
    }
});

app.post("/verify-face", async (req, res) => {
    const { username, faceData } = req.body;
    if (!username || !faceData) return res.json({ success: false });
    try {
        const result = await db.query("SELECT face_data FROM face_users WHERE username = $1", [username]);
        if (result.rows.length === 0) return res.json({ success: false });
        const savedFace = JSON.parse(result.rows[0].face_data);
        let sum = 0;
        for (let i = 0; i < savedFace.length; i++) sum += Math.pow(savedFace[i] - faceData[i], 2);
        res.json({ success: Math.sqrt(sum) < 0.6 });
    } catch (err) {
        res.json({ success: false });
    }
});

app.listen(process.env.PORT || 3000, () => {
    console.log("Server running at http://localhost:" + (process.env.PORT || 3000));
});
'@