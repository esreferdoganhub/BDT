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
app.post('/yukle', upload.single('dosya'), async (req, res) => {
    try {
        const { adSoyad, ogrenciNo, dersAdi, sinif } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ durum: "hata", mesaj: "Dosya seçilmedi!" });
        }

        // Zaman Damgası (UTC+3 - İstanbul/Türkiye)
        const timestamp = moment().tz("Europe/Istanbul").format("YYYYMMDD_HHmmss");
        
        // Yeni Dosya Adı: ogrenciNo_adSoyad_YYYYMMDD_HHmmss.[uzantı]
        const temizAdSoyad = adSoyad.replace(/\s+/g, '_');
        const fileExt = file.originalname.includes('.') ? file.originalname.split('.').pop() : 'bin';
        const newFileName = `${ogrenciNo}_${temizAdSoyad}_${timestamp}.${fileExt}`;

        console.log(`Yükleme Başlatıldı (Bridge): ${newFileName} - Ders: ${dersAdi} - Sınıf: ${sinif}`);

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
            mimeType: file.mimetype // Mimetype bilgisini de iletelim
        }, {
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });

        if (response.data.status === 'success') {
            console.log(`Başarıyla Yüklendi (Bridge): ${newFileName} (Drive ID: ${response.data.fileId})`);
            res.json({
                durum: "ok",
                dosyaAdi: newFileName,
                klasor: sinif
            });
        } else {
            throw new Error(response.data.message || "Apps Script hatası");
        }

    } catch (error) {
        console.error("Yükleme Hatası (Bridge):", error);
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
