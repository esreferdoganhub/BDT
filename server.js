const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { google } = require('googleapis');
const moment = require('moment-timezone');
const dotenv = require('dotenv');
const { Readable } = require('stream');

// .env dosyasını yükle
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Multer Yapılandırması (Memory Storage)
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/zip' || file.originalname.endsWith('.zip')) {
            cb(null, true);
        } else {
            cb(new Error('Sadece .zip dosyaları kabul edilmektedir!'), false);
        }
    }
});

// Google Drive API Yetkilendirme
const auth = new google.auth.JWT(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    null,
    process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/drive']
);

const drive = google.drive({ version: 'v3', auth });

/**
 * Drive'da klasör bulur, yoksa oluşturur.
 * @param {string} folderName Klasör adı
 * @param {string} parentId Üst klasör ID (opsiyonel)
 * @returns {Promise<string>} Klasör ID
 */
async function getOrCreateFolder(folderName, parentId = null) {
    let query = `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    if (parentId) {
        query += ` and '${parentId}' in parents`;
    }

    const response = await drive.files.list({
        q: query,
        fields: 'files(id, name)',
        spaces: 'drive',
    });

    if (response.data.files.length > 0) {
        return response.data.files[0].id;
    }

    // Klasör yoksa oluştur
    const folderMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentId ? [parentId] : []
    };

    const folder = await drive.files.create({
        resource: folderMetadata,
        fields: 'id',
    });

    return folder.data.id;
}

// Sağlık Kontrolü Endpoint
app.get('/saglik', (req, res) => {
    res.json({ durum: "aktif" });
});

// Dosya Yükleme Endpoint
app.post('/yukle', upload.single('dosya'), async (req, res) => {
    try {
        const { adSoyad, ogrenciNo, sinif } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ durum: "hata", mesaj: "Dosya seçilmedi!" });
        }

        // Zaman Damgası (UTC+3 - İstanbul/Türkiye)
        const timestamp = moment().tz("Europe/Istanbul").format("YYYYMMDD_HHmmss");
        
        // Yeni Dosya Adı: ogrenciNo_adSoyad_YYYYMMDD_HHmmss.zip
        // Dosya ismindeki boşlukları temizleyelim
        const temizAdSoyad = adSoyad.replace(/\s+/g, '_');
        const newFileName = `${ogrenciNo}_${temizAdSoyad}_${timestamp}.zip`;

        console.log(`Yükleme Başlatıldı: ${newFileName} - Sınıf: ${sinif}`);

        // 1. Ana BDT klasörünü bul/oluştur
        const bdtFolderId = await getOrCreateFolder('BDT');

        // 2. Sınıf klasörünü BDT altında bul/oluştur
        const classFolderId = await getOrCreateFolder(sinif, bdtFolderId);

        // 3. Dosyayı Drive'a yükle
        const bufferStream = new Readable();
        bufferStream.push(file.buffer);
        bufferStream.push(null);

        const driveResponse = await drive.files.create({
            requestBody: {
                name: newFileName,
                parents: [classFolderId]
            },
            media: {
                mimeType: 'application/zip',
                body: bufferStream
            },
            fields: 'id'
        });

        console.log(`Başarıyla Yüklendi: ${newFileName} (ID: ${driveResponse.data.id})`);

        res.json({
            durum: "ok",
            dosyaAdi: newFileName,
            klasor: sinif
        });

    } catch (error) {
        console.error("Yükleme Hatası:", error);
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
    console.log(`API Sunucusu çalışıyor: http://localhost:${PORT}`);
});
