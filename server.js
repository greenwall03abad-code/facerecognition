const express = require("express");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const path = require("path");
const QRCode = require("qrcode");

const app = express();
app.use(express.json());

app.use(express.static("public"));
app.use("/models", express.static(path.join(__dirname, "models")));

/* ================= DATABASE ================= */
const db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

db.connect()
    .then(() => console.log("✅ Supabase PostgreSQL Connected!"))
    .catch(err => console.error("❌ DB CONNECTION ERROR:", err.message));

/* ================= REGISTER ================= */
app.post("/register", async (req, res) => {
    console.log("REGISTER BODY:", req.body);
    const { username, password, faceData } = req.body;
    if (!username || !password || !faceData)
        return res.json({ success: false, message: "Missing data" });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await db.query(
            "INSERT INTO users (username, password, face_data) VALUES ($1, $2, $3) RETURNING id",
            [username, hashedPassword, JSON.stringify(faceData)]
        );
        const insertId = result.rows[0].id;
        const qrData = `${insertId}-${username}`;
        const qrImage = await QRCode.toDataURL(qrData, {
            width: 300, margin: 2,
            color: { dark: '#000000', light: '#ffffff' }
        });
        res.json({ success: true, qrCode: qrImage, userId: insertId });
    } catch (error) {
        console.log("❌ REGISTER ERROR:", error);
        res.json({ success: false, message: "Username already exists" });
    }
});

/* ================= LOGIN (PASSWORD) ================= */
app.post("/login", async (req, res) => {
    console.log("LOGIN BODY:", req.body);
    const { username, password } = req.body;
    if (!username || !password) return res.json({ success: false });

    try {
        const result = await db.query(
            "SELECT * FROM users WHERE username = $1", [username]
        );
        if (result.rows.length === 0) return res.json({ success: false });
        const user = result.rows[0];
        const match = await bcrypt.compare(password, user.password);
        res.json({ success: match });
    } catch (err) {
        console.log("❌ LOGIN ERROR:", err);
        res.json({ success: false });
    }
});

/* ================= FACE VERIFY ================= */
app.post("/verify-face", async (req, res) => {
    console.log("VERIFY FACE BODY:", req.body);
    const { username, faceData } = req.body;
    if (!username || !faceData) return res.json({ success: false });

    try {
        const result = await db.query(
            "SELECT face_data FROM users WHERE username = $1", [username]
        );
        if (result.rows.length === 0) return res.json({ success: false });
        const savedFace = JSON.parse(result.rows[0].face_data);
        let sum = 0;
        for (let i = 0; i < savedFace.length; i++) {
            sum += Math.pow(savedFace[i] - faceData[i], 2);
        }
        const distance = Math.sqrt(sum);
        console.log("FACE DISTANCE:", distance);
        res.json({ success: distance < 0.6 });
    } catch (err) {
        console.log("❌ VERIFY ERROR:", err);
        res.json({ success: false });
    }
});

/* ================= START SERVER ================= */
app.listen(process.env.PORT || 3000, () => {
    console.log("🚀 Server running at http://localhost:" + (process.env.PORT || 3000));
    console.log("📁 Serving models from: ./models/");
});
