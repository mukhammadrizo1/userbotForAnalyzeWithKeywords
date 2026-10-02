import { Injectable, signal } from '@angular/core';

export type Language = 'uz' | 'ru';

@Injectable({
  providedIn: 'root',
})
export class I18nService {
  currentLang = signal<Language>('uz');

  private translations: Record<Language, Record<string, string>> = {
    uz: {
      // Nav
      'nav.channels': 'Kanallar',
      'nav.keywords': 'Kalit So\'zlar',
      'nav.groups': 'Guruhlar',
      'nav.history': 'Tahlil Tarixi',
      'nav.tester': 'AI Sinov',
      'nav.inspector': 'Vaqt Oralig\'i',
      'nav.logs': 'Jonli Loglar',
      'nav.system': 'Tizim Holati',
      'nav.logout': 'Chiqish',
      'nav.online': 'Userbot Online',
      'nav.offline': 'Userbot Offline',

      // Topbar
      'topbar.tg_active': 'Telegram Faol',
      'topbar.tg_idle': 'Bot Kutishda',
      'topbar.refresh': 'Yangilash',
      'topbar.paused': 'To\'xtatilgan (Davom ettirish)',
      'topbar.simulation': '🧪 Simulyatsiya',

      // Section titles
      'title.channels': 'Telegram Kanallari',
      'title.keywords': 'Qidiruv Kalit So\'zlari',
      'title.groups': 'Guruhlar & Yo\'naltirish',
      'title.history': 'Tahlil Tarixi',
      'title.tester': 'AI Sinov Maydoni',
      'title.inspector': 'Vaqt Oralig\'i Tahlili',
      'title.logs': 'Jonli Tizim Loglari',
      'title.system': 'Tizim & AI Holati',
      'title.default': 'Boshqaruv Paneli',

      // Section subtitles
      'sub.channels': 'Userbot real-vaqtda postlarini tinglaydigan ommaviy kanallar',
      'sub.keywords': 'Postlarda AI tahlilini faollashtiruvchi kalit iboralar',
      'sub.groups': 'Tahlil natijalariga ko\'ra xabarlar yo\'naltiriladigan guruhlar',
      'sub.history': 'Groq AI tahlilidan o\'tgan so\'nggi 50 ta xabarlar arxivi',
      'sub.tester': 'Xabarlarni Groq AI va kalit so\'zlar bo\'yicha mustaqil sinovdan o\'tkazish',
      'sub.inspector': 'Telegram kanallaridagi o\'tmishdagi postlarni tahlil qilish va ommaviy yo\'naltirish',
      'sub.logs': 'Userbot va AI xizmatlarining real-vaqtdagi jarayonlarini kuzatish',
      'sub.system': 'Telegram MTProto va Groq Llama 3 tizim holati parametrlari',
      'sub.default': 'UTY Monitoring va AI filtr boshqaruvi',

      // Inspector
      'inspector.title': 'Vaqt Oralig\'i Tahlili (Range Inspector)',
      'inspector.subtitle': 'Telegram kanallaridagi o\'tmishdagi postlarni tahlil qilish, AI xulosasini olish va guruhlarga yo\'naltirish',
      'inspector.channels_label': '1. Qaysi Kanallarni Tekshirish?',
      'inspector.channels_all': 'Barcha Kanallar',
      'inspector.channels_selected': 'Tanlangan Kanallar',
      'inspector.channels_custom': 'Maxsus Kanal',
      'inspector.custom_channel_ph': 'Kanal username yoki havolasi (masalan: @gazetauz yoki https://t.me/daryo)',
      'inspector.public_hint': 'ℹ️ Begona ommaviy kanallarni ham a\'zo bo\'lmasdan tekshira oladi',
      'inspector.range_label': '2. Vaqt Oralig\'i (Toshkent vaqti UTC+5)',
      'inspector.range_3h': 'Oxirgi 3 soat',
      'inspector.range_today': 'Bugun',
      'inspector.range_24h': 'Oxirgi 24 soat',
      'inspector.range_3d': 'Oxirgi 3 kun',
      'inspector.range_custom': 'Maxsus sana',
      'inspector.start_date': 'Boshlanish vaqti (Toshkent):',
      'inspector.end_date': 'Tugash vaqti (Toshkent):',
      'inspector.kw_label': '3. Qaysi Kalit So\'zlar Bo\'yicha Tahlil Qilinsin?',
      'inspector.kw_all': '1. Bazadagi Barcha So\'zlar',
      'inspector.kw_selected': '2. Bazadan Tanlanganlar',
      'inspector.kw_custom': '3. Qo\'lda Kiritilgan So\'zlar',
      'inspector.kw_none': 'Barcha Postlar (So\'zsiz)',
      'inspector.kw_custom_ph': 'Kalit so\'zlarni vergul bilan kiriting (masalan: poyezd, vagon, chipta, narx, kechikish)',
      'inspector.kw_custom_hint': 'ℹ️ Ushbu so\'zlar faqat qidiruv uchun ishlatiladi, bazaga doimiy saqlanmaydi',
      'inspector.kw_search_ph': 'Kalit so\'zni qidirish...',
      'inspector.btn_scan': 'Vaqt Oralig\'ini Tahlil Qilish',
      'inspector.btn_scanning': 'Telegram Postlari Skanerlanmoqda...',
      'inspector.results_title': 'Skanerlash Natijalari',
      'inspector.stat_total': 'Topildi',
      'inspector.stat_unsent': 'Yuborilmagan',
      'inspector.stat_sent': 'Yuborilgan',
      'inspector.stat_skipped': 'ta yopiq kanal o\'tkazildi',
      'inspector.tab_all': 'Barchasi',
      'inspector.tab_unsent': 'Yuborilmaganlar',
      'inspector.tab_sent': 'Yuborilganlar',
      'inspector.search_results_ph': 'Natijalar ichidan qidirish...',
      'inspector.select_all': 'Barchasini tanlash',
      'inspector.select_unsent': 'Faqat yuborilmaganlarni tanlash',
      'inspector.clear_select': 'Tanlovni bekor qilish',
      'inspector.selected_posts': 'ta post tanlandi',
      'inspector.empty_title': 'Mos keluvchi postlar topilmadi',
      'inspector.empty_sub': 'Boshqa vaqt oralig\'i yoki kalit so\'zlarni tanlab qayta urinib ko\'ring',
      'inspector.matched_kw': 'Topilgan kalit so\'zlar:',
      'inspector.no_kw_filter': 'Kalit so\'zsiz qidiruv',
      'inspector.tg_view': 'Telegramda ko\'rish',
      'inspector.details': 'Batafsil matn',
      'inspector.btn_ai_analyze': '🤖 AI Tahlil',
      'inspector.btn_ai_analyzing': 'Tahlil qilinmoqda...',
      'inspector.btn_bulk_ai': '🤖 Tanlanganlarni AI orqali tahlil qilish',
      'inspector.btn_bulk_forward': '✈️ Guruh / Chatlarga Yo\'naltirish',
      'inspector.forward_title': 'Postlarni yo\'naltirish',
      'inspector.forward_target_type': 'Manzil turini tanlang:',
      'inspector.target_groups': 'Tizim Guruhlariga',
      'inspector.target_custom': 'Ixtiyoriy Chat / Guruhlarga',
      'inspector.select_groups_label': 'Yo\'naltiriladigan guruhlarni belgilang (bir yoki bir nechta):',
      'inspector.custom_targets_label': 'Chat ID yoki @username larni kiriting (vergul yoki yangi qator bilan bir nechta kiritish mumkin):',
      'inspector.custom_targets_ph': 'Masalan: @chat1, @kanal2, -1001234567, -1009876543',
      'inspector.custom_targets_hint': 'ℹ️ Userbot ushbu chatlarda xabar yozish ruxsatiga ega bo\'lishi kerak',
      'inspector.btn_confirm_send': 'Tasdiqlash va Yuborish',
      'inspector.btn_sending': 'Yuborilmoqda...',
      'inspector.close': 'Yopish',
      'inspector.cancel': 'Bekor qilish',
      'inspector.timezone_note': 'O\'zbekiston (Toshkent) vaqti bo\'yicha',
    },
    ru: {
      // Nav
      'nav.channels': 'Каналы',
      'nav.keywords': 'Ключевые слова',
      'nav.groups': 'Группы',
      'nav.history': 'История анализа',
      'nav.tester': 'AI Тестер',
      'nav.inspector': 'Диапазон времени',
      'nav.logs': 'Живые логи',
      'nav.system': 'Состояние системы',
      'nav.logout': 'Выход',
      'nav.online': 'Юзербот Онлайн',
      'nav.offline': 'Юзербот Офлайн',

      // Topbar
      'topbar.tg_active': 'Telegram Активен',
      'topbar.tg_idle': 'Ожидание бота',
      'topbar.refresh': 'Обновить',
      'topbar.paused': 'Приостановлен (Возобновить)',
      'topbar.simulation': '🧪 Симуляция',

      // Section titles
      'title.channels': 'Telegram Каналы',
      'title.keywords': 'Ключевые Слова',
      'title.groups': 'Группы & Пересылка',
      'title.history': 'История Анализа',
      'title.tester': 'AI Тестер',
      'title.inspector': 'Анализ Диапазона Времени',
      'title.logs': 'Системные Логи Live',
      'title.system': 'Состояние Системы & AI',
      'title.default': 'Панель Управления',

      // Section subtitles
      'sub.channels': 'Публичные каналы, отслеживаемые юзерботом в реальном времени',
      'sub.keywords': 'Ключевые фразы, активирующие анализ AI при обнаружении в постах',
      'sub.groups': 'Группы пересылки сообщений по результатам AI тональности',
      'sub.history': 'Архив последних сообщений, проанализированных Groq AI',
      'sub.tester': 'Тестирование текстов на ключевые слова и анализ тональности в Groq AI',
      'sub.inspector': 'Анализ постов Telegram за период времени и массовая пересылка',
      'sub.logs': 'Мониторинг логов и процессов юзербота и AI в реальном времени',
      'sub.system': 'Параметры состояния Telegram MTProto и Groq Llama 3',
      'sub.default': 'Мониторинг UTY и управление AI фильтрацией',

      // Inspector
      'inspector.title': 'Анализ Временного Диапазона (Range Inspector)',
      'inspector.subtitle': 'Анализ исторических постов Telegram каналов по времени и ключевым словам, генерация AI вердикта и пересылка',
      'inspector.channels_label': '1. Какие каналы проверять?',
      'inspector.channels_all': 'Все каналы',
      'inspector.channels_selected': 'Выбранные каналы',
      'inspector.channels_custom': 'Пользовательский канал',
      'inspector.custom_channel_ph': 'Username или ссылка на канал (например: @gazetauz или https://t.me/daryo)',
      'inspector.public_hint': 'ℹ️ Доступна проверка любых публичных каналов без подписки',
      'inspector.range_label': '2. Временной диапазон (Время по Ташкенту UTC+5)',
      'inspector.range_3h': 'Последние 3 часа',
      'inspector.range_today': 'Сегодня',
      'inspector.range_24h': 'Последние 24 часа',
      'inspector.range_3d': 'Последние 3 дня',
      'inspector.range_custom': 'Точные даты',
      'inspector.start_date': 'Время начала (Ташкент):',
      'inspector.end_date': 'Время окончания (Ташкент):',
      'inspector.kw_label': '3. По каким ключевым словам искать?',
      'inspector.kw_all': '1. Все слова из базы',
      'inspector.kw_selected': '2. Выбранные из базы',
      'inspector.kw_custom': '3. Введенные вручную слова',
      'inspector.kw_none': 'Все посты (без слов)',
      'inspector.kw_custom_ph': 'Введите ключевые слова через запятую (например: поезд, вагон, билет, цена, задержка)',
      'inspector.kw_custom_hint': 'ℹ️ Эти слова используются только для поиска и не сохраняются в базе насовсем',
      'inspector.kw_search_ph': 'Поиск ключевого слова...',
      'inspector.btn_scan': 'Запустить Анализ Диапазона',
      'inspector.btn_scanning': 'Сканирование постов Telegram...',
      'inspector.results_title': 'Результаты сканирования',
      'inspector.stat_total': 'Найдено',
      'inspector.stat_unsent': 'Не отправлено',
      'inspector.stat_sent': 'Отправлено',
      'inspector.stat_skipped': 'закрытых каналов пропущено',
      'inspector.tab_all': 'Все',
      'inspector.tab_unsent': 'Не отправленные',
      'inspector.tab_sent': 'Отправленные',
      'inspector.search_results_ph': 'Поиск по результатам...',
      'inspector.select_all': 'Выбрать все',
      'inspector.select_unsent': 'Только не отправленные',
      'inspector.clear_select': 'Снять выбор',
      'inspector.selected_posts': 'постов выбрано',
      'inspector.empty_title': 'Подходящих постов не найдено',
      'inspector.empty_sub': 'Попробуйте выбрать другой диапазон дат или изменить ключевые слова',
      'inspector.matched_kw': 'Найденные ключевые слова:',
      'inspector.no_kw_filter': 'Поиск без фильтра ключевых слов',
      'inspector.tg_view': 'Открыть в Telegram',
      'inspector.details': 'Полный текст',
      'inspector.btn_ai_analyze': '🤖 AI Анализ',
      'inspector.btn_ai_analyzing': 'Анализируется...',
      'inspector.btn_bulk_ai': '🤖 Анализировать выбранные через AI',
      'inspector.btn_bulk_forward': '✈️ Переслать в группы / чаты',
      'inspector.forward_title': 'Пересылка постов',
      'inspector.forward_target_type': 'Выберите тип адресата:',
      'inspector.target_groups': 'В системные группы',
      'inspector.target_custom': 'В любые чаты / группы',
      'inspector.select_groups_label': 'Отметьте целевые группы (одну или несколько):',
      'inspector.custom_targets_label': 'Укажите ID чатов или @username (можно несколько через запятую или с новой строки):',
      'inspector.custom_targets_ph': 'Например: @chat1, @kanal2, -1001234567, -1009876543',
      'inspector.custom_targets_hint': 'ℹ️ Юзербот должен иметь право отправки сообщений в указанных чатах',
      'inspector.btn_confirm_send': 'Подтвердить и Отправить',
      'inspector.btn_sending': 'Отправка...',
      'inspector.close': 'Закрыть',
      'inspector.cancel': 'Отмена',
      'inspector.timezone_note': 'Время Узбекистана (Ташкент)',
    },
  };

  constructor() {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('app_lang') as Language;
      if (saved === 'uz' || saved === 'ru') {
        this.currentLang.set(saved);
      }
    }
  }

  setLanguage(lang: Language): void {
    this.currentLang.set(lang);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('app_lang', lang);
    }
  }

  t(key: string): string {
    const lang = this.currentLang();
    return this.translations[lang]?.[key] || this.translations['uz']?.[key] || key;
  }
}
