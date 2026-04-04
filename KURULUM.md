# BDT Dosya Teslim Sistemi - Kurulum Rehberi

Bu rehber, sistemin Google Drive, Hetzner Sunucusu ve GitHub Pages üzerinde nasıl kurulacağını adım adım anlatmaktadır.

---

## 1. Google Drive API & Service Account Ayarları

### A. Proje Oluşturma
1. [Google Cloud Console](https://console.cloud.google.com/) adresine gidin.
2. Yeni bir proje oluşturun (Örn: `BDT-Teslim-Sistemi`).
3. Sol menüden **APIs & Services > Library** kısmına girin.
4. "Google Drive API" aratın ve **Enable** (Etkinleştir) butonuna basın.

### B. Service Account (Hizmet Hesabı) Oluşturma
1. **APIs & Services > Credentials** sayfasına gidin.
2. **Create Credentials > Service Account** seçeneğine tıklayın.
3. Bir isim verin (`bdt-api-user`) ve **Create and Continue** diyerek ilerleyin (Rol seçimi isteğe bağlıdır, boş bırakabilirsiniz).
4. Oluşturulan Service Account'un altında **Keys** sekmesine gidin.
5. **Add Key > Create New Key > JSON** seçerek indirin.
6. Bu JSON dosyasındaki `client_email` ve `private_key` değerlerini saklayın.

### C. Drive Üzerinde Yetkilendirme (EN ÖNEMLİ ADIM)
1. Kendi Google Drive'ınıza gidin.
2. Ana dizinde **BDT** adında bir klasör oluşturun.
3. Bu klasöre sağ tıklayın > **Share** (Paylaş).
4. Service Account e-posta adresinizi (`...@[proje-id].iam.gserviceaccount.com`) ekleyin.
5. Yetkiyi **Editor** (Düzenleyici) olarak ayarlayın ve kaydedin.

---

## 2. Hetzner Sunucu (Backend) Kurulumu

### A. Sunucu Hazırlığı (Ubuntu)
Sunucunuza SSH ile bağlandıktan sonra şu komutları çalıştırın:

```bash
# Paket listesini güncelle
sudo apt update && sudo apt upgrade -y

# Node.js 20.x Kurulumu
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PM2 (Süreci yönetmek için) Kurulumu
sudo npm install -g pm2
```

### B. Kodun Aktarılması ve Yapılandırma
1. Klasörünüzü oluşturun: `mkdir bdt-system && cd bdt-system`
2. `server.js` ve `package.json` dosyalarını sunucuya aktarın (veya `git clone` yapın).
3. Bağımlılıkları kurun: `npm install`
4. `.env` dosyası oluşturun (`nano .env`) ve içeriği doldurun:

```env
PORT=3000
GOOGLE_SERVICE_ACCOUNT_EMAIL=buraya_paylasilan_email
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```
*Not: Private key'i tırnak içinde ve \n karakterleri dahil olacak şekilde yapıştırın.*

### C. Uygulamayı Başlatma
```bash
# PM2 ile başlat
pm2 start server.js --name bdt-api

# Sunucu her açıldığında otomatik çalışması için
pm2 startup
pm2 save

# Firewall - 3000 portunu aç (Gerekliyse)
sudo ufw allow 3000
```

---

## 3. GitHub Pages (Frontend) Kurulumu

1. `index.html` dosyasını açın.
2. En üstteki `const API_URL = "http://SUNUCU_IP:3000";` satırındaki `SUNUCU_IP` kısmını Hetzner sunucunuzun IP adresi ile değiştirin.
3. Dosyayı GitHub'daki `esreferdoganhub/BDT` reposuna push edin.
4. Repo ayarlarından (Settings > Pages) GitHub Pages'i aktif edin.

---

## 4. Test Etme

### API Sağlık Kontrolü
Tarayıcıdan veyaTerminalden kontrol edin:
`curl http://SUNUCU_IP:3000/saglik`
Yanıt: `{"durum": "aktif"}`

### Yükleme Testi
1. GitHub Pages linkinize gidin.
2. Formu doldurun ve küçük bir `.zip` dosyası seçin.
3. "Dosyayı Gönder" butonuna basın.
4. Yükleme tamamlanınca Drive'daki **BDT/Elektronik_1** klasörünü kontrol edin.

---

### Sorun Giderme
- **Hata: Google Drive API yetkisi yok**: 1.C adımını tekrar kontrol edin, klasörün paylaşıldığından emin olun.
- **Hata: Sunucuya bağlanılamıyor**: Hetzner üzerinde 3000 portunun açık olduğundan ve server'ın çalıştığından (`pm2 status`) emin olun.
- **Hata: 400 Hataları**: Dosyanın gerçekten `.zip` uzantılı ve 50MB'dan küçük olduğundan emin olun.
