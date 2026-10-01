const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const readline = require('readline');
const path = require('path');
const qrcode = require('qrcode-terminal');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

(async () => {
  console.log('\n=========================================');
  console.log('   Telegram Session String Generator');
  console.log('=========================================\n');

  let apiId = parseInt(process.env.TELEGRAM_API_ID || '', 10);
  let apiHash = process.env.TELEGRAM_API_HASH || '';

  if (!apiId || isNaN(apiId)) {
    const idInput = await question('TELEGRAM_API_ID ni kiriting: ');
    apiId = parseInt(idInput.trim(), 10);
  } else {
    console.log(`TELEGRAM_API_ID .env dan olindi: ${apiId}`);
  }

  if (!apiHash) {
    apiHash = (await question('TELEGRAM_API_HASH ni kiriting: ')).trim();
  } else {
    console.log('TELEGRAM_API_HASH .env dan olindi.');
  }

  console.log('\nKirish usulini tanlang:');
  console.log('1. [TAVSIYA ETILADI] QR-kod orqali (Kod yoki SMS kutish SHART EMAS!)');
  console.log('2. Telefon raqam va SMS/Kod orqali');

  const choice = (await question('\nTanlovingiz (1 yoki 2) [standart: 1]: ')).trim() || '1';

  const client = new TelegramClient(new StringSession(''), apiId, apiHash.trim(), {
    connectionRetries: 5,
  });

  await client.connect();

  if (choice === '1') {
    console.log('\nQR-kod yaratilmoqda...\n');
    console.log('📱 Telegram ilovangizni oching:');
    console.log('👉 Sozlamalar (Settings) -> Qurilmalar (Devices) -> Qurilmani ulash (Link Desktop Device)');
    console.log('👉 Va kamerani quyidagi QR-kodga qarating:\n');

    try {
      await client.signInUserWithQrCode(
        { apiId, apiHash: apiHash.trim() },
        {
          qrCode: async (code) => {
            const tokenStr = Buffer.from(code.token).toString('base64url');
            const url = `tg://login?token=${tokenStr}`;
            console.clear();
            console.log('📱 Telegram -> Sozlamalar -> Qurilmalar -> "Qurilmani ulash" orqali skanerlang:\n');
            qrcode.generate(url, { small: true });
            console.log('\nKutilmoqda... (QR-kod har 30 soniyada yangilanadi)\n');
          },
          password: async () => {
            return (await question('\nIkki bosqichli 2FA parolingizni kiriting: ')).trim();
          },
          onError: (err) => {
            console.error('Xatolik:', err);
          },
        }
      );
    } catch (err) {
      console.error('\n❌ Ulanishda xatolik:', err.message || err);
      rl.close();
      process.exit(1);
    }
  } else {
    const phoneNumber = (await question('\nTelefon raqamingiz (+998...): ')).trim();
    console.log('\n⚠️ DIQQAT: Telegram kodni SMS tarzda yuborishi mumkin. SMS laringizni ham tekshiring!\n');

    try {
      await client.start({
        phoneNumber: async () => phoneNumber,
        password: async () => (await question('2FA Parolingiz (agar bo\'lmasa Enter): ')).trim(),
        phoneCode: async () => (await question('SMS yoki Telegramdan kelgan tasdiqlash kodi: ')).trim(),
        onError: (err) => console.error('Xatolik:', err),
      });
    } catch (err) {
      console.error('\n❌ Ulanishda xatolik:', err.message || err);
      rl.close();
      process.exit(1);
    }
  }

  console.log('\n✅ Telegramga muvaffaqiyatli ulandi!');
  const sessionString = client.session.save();

  console.log('\n=========================================');
  console.log('Sizning yangi TELEGRAM_STRING_SESSION:');
  console.log('=========================================\n');
  console.log(sessionString);
  console.log('\n=========================================\n');

  rl.close();
  process.exit(0);
})();
