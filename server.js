const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const moment = require('moment-timezone');
const dotenv = require('dotenv');

// .env dosyasını yükle
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Multer Yapılandırması (Memory Storage)
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Sağlık Kontrolü Endpoint
app.get('/saglik', (req, res) => {
    res.json({ durum: "aktif", mod: "apps-script-bridge" });
});

// Dosya Yükleme Endpoint
app.post('/yukle', upload.array('dosya', 10), async (req, res) => {
    try {
        const { adSoyad, ogrenciNo, dersAdi, sinif } = req.body;
        const files = req.files;

        if (!files || files.length === 0) {
            return res.status(400).json({ durum: "hata", mesaj: "Dosya seçilmedi!" });
        }

        // IP Adresini Al (Proxy arkasında olduğu için x-forwarded-for kontrolü)
        let clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        if (clientIp.includes(',')) clientIp = clientIp.split(',')[0];
        clientIp = clientIp.replace(/[:.]/g, '-'); // Dosya ismi için temizle

        console.log(`Çoklu Yükleme Başlatıldı (Bridge): ${files.length} dosya - Ders: ${dersAdi} - IP: ${clientIp}`);

        const uploadResults = [];
        const timestamp = moment().tz("Europe/Istanbul").format("YYYYMMDD_HHmmss");

        for (const file of files) {
            // Yeni Dosya Adı: ogrenciNo_IP_adSoyad_YYYYMMDD_HHmmss.[uzantı]
            const temizAdSoyad = adSoyad.replace(/\s+/g, '_');
            const fileExt = file.originalname.includes('.') ? file.originalname.split('.').pop() : 'bin';
            const newFileName = `${ogrenciNo}_${clientIp}_${temizAdSoyad}_${timestamp}_${Math.floor(Math.random() * 1000)}.${fileExt}`;

            // Dosyayı Base64'e çevir (Apps Script için)
            const fileBase64 = file.buffer.toString('base64');

            // Google Apps Script Web App'e gönder
            const response = await axios.post(process.env.APPS_SCRIPT_URL, {
                adSoyad,
                ogrenciNo,
                dersAdi,
                sinif,
                fileName: newFileName,
                fileBase64: fileBase64,
                mimeType: file.mimetype
            }, {
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });

            if (response.data.status === 'success') {
                console.log(`Başarıyla Yüklendi (Bridge): ${newFileName} (Drive ID: ${response.data.fileId})`);
                uploadResults.push({ name: newFileName, status: "ok" });
            } else {
                console.error(`Yükleme Hatası (File: ${newFileName}):`, response.data.message);
                uploadResults.push({ name: newFileName, status: "error", message: response.data.message });
            }
        }

        const successCount = uploadResults.filter(r => r.status === "ok").length;
        
        if (successCount === 0) {
            throw new Error("Hiçbir dosya yüklenemedi.");
        }

        res.json({
            durum: "ok",
            mesaj: `${successCount} dosya başarıyla yüklendi.`,
            detaylar: uploadResults
        });

    } catch (error) {
        console.error("Genel Yükleme Hatası (Bridge):", error);
        res.status(500).json({
            durum: "hata",
            mesaj: error.message || "Sunucu tarafında bir hata oluştu."
        });
    }
});

// Hata Yakalama (Multer hataları için)
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ durum: "hata", mesaj: "Dosya boyutu çok büyük! Maksimum 50MB." });
        }
        return res.status(400).json({ durum: "hata", mesaj: err.message });
    } else if (err) {
        return res.status(400).json({ durum: "hata", mesaj: err.message });
    }
    next();
});

// Başlat
app.listen(PORT, () => {
    console.log(`API Sunucusu (Bridge Mode) çalışıyor: http://localhost:${PORT}`);
});
