const express = require("express");
const mysql = require("mysql2");
const bcrypt = require("bcrypt");
const path = require("path");

const app = express();
app.use(express.json());

// ✅ Serve HTML files from public folder
app.use(express.static("public"));

// ✅ Serve face-api model files from models folder at /models route
app.use("/models", express.static(path.join(__dirname, "models")));

/* ================= DATABASE ================= */
const db = mysql.createConnection({
    host: process.env.MYSQLHOST || "localhost",
    user: process.env.MYSQLUSER || "root",
    password: process.env.MYSQLPASSWORD || "",
    database: process.env.MYSQLDATABASE || "marcface_db",
    port: process.env.MYSQLPORT || 3306
});

db.connect((err) => {
    if (err) {
        console.error("❌ DB CONNECTION ERROR:", err.message);
        return;
    }

    console.log("✅ MySQL Connected Successfully!");
    console.log("📦 Active Database:", db.config.database);
});

/* ================= REGISTER ================= */
app.post("/register", async (req, res) => {

    console.log("REGISTER BODY:", req.body);

    const { username, password, faceData } = req.body;

    if (!username || !password || !faceData) {
        return res.json({ success: false, message: "Missing data" });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        db.query(
            "INSERT INTO users (username, password, face_data) VALUES (?, ?, ?)",
            [username, hashedPassword, JSON.stringify(faceData)],
            (err) => {
                if (err) {
                    console.log("❌ INSERT ERROR:", err);
                    return res.json({
                        success: false,
                        message: "Username already exists"
                    });
                }
                res.json({ success: true });
            }
        );

    } catch (error) {
        console.log("❌ REGISTER ERROR:", error);
        res.json({ success: false });
    }
});

/* ================= LOGIN (PASSWORD) ================= */
app.post("/login", (req, res) => {

    console.log("LOGIN BODY:", req.body);

    const { username, password } = req.body;

    if (!username || !password) {
        return res.json({ success: false });
    }

    db.query(
        "SELECT * FROM users WHERE username = ?",
        [username],
        async (err, result) => {

            if (err || result.length === 0) {
                return res.json({ success: false });
            }

            const user = result[0];
            const match = await bcrypt.compare(password, user.password);

            if (!match) {
                return res.json({ success: false });
            }

            res.json({ success: true });
        }
    );
});

/* ================= FACE VERIFY ================= */
app.post("/verify-face", (req, res) => {

    console.log("VERIFY FACE BODY:", req.body);

    const { username, faceData } = req.body;

    if (!username || !faceData) {
        return res.json({ success: false });
    }

    db.query(
        "SELECT face_data FROM users WHERE username = ?",
        [username],
        (err, result) => {

            if (err || result.length === 0) {
                return res.json({ success: false });
            }

            const savedFace = JSON.parse(result[0].face_data);

            let sum = 0;
            for (let i = 0; i < savedFace.length; i++) {
                sum += Math.pow(savedFace[i] - faceData[i], 2);
            }

            const distance = Math.sqrt(sum);
            console.log("FACE DISTANCE:", distance);

            res.json({ success: distance < 0.6 });
        }
    );
});

/* ================= START SERVER ================= */
app.listen(process.env.PORT || 3000, () => {
    console.log("🚀 Server running at http://localhost:" + (process.env.PORT || 3000));
    console.log("📁 Serving models from: ./models/");
});