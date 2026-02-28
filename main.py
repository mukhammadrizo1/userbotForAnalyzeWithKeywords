import asyncio
import sqlite3
import logging
import os
from telethon import TelegramClient, events
from groq import AsyncGroq

# ---------------- SOZLAMALAR ----------------
def _get_required_env(name, cast=str):
    value = os.getenv(name)
    if value is None or not str(value).strip():
        raise RuntimeError(f"Missing required environment variable: {name}")
    try:
        return cast(value)
    except Exception as e:
        raise RuntimeError(f"Invalid value for {name}: {e}")

api_id = _get_required_env("TELEGRAM_API_ID", int)
api_hash = _get_required_env("TELEGRAM_API_HASH", str)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile").strip() or "llama-3.3-70b-versatile"

# SESSION FAYL NOMI
SESSION_NAME = "telethon_userbot"

# ---------------- LOGGING ----------------
logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(message)s")
log = logging.getLogger(__name__)

# ---------------- MA'LUMOTLAR BAZASI ----------------
DB_NAME = "bot_data.db"

def init_db():
    """Bazani va jadvallarni yaratish"""
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        cursor.execute("CREATE TABLE IF NOT EXISTS channels (ident TEXT PRIMARY KEY)")
        cursor.execute("CREATE TABLE IF NOT EXISTS keywords (word TEXT PRIMARY KEY)")
        cursor.execute("CREATE TABLE IF NOT EXISTS groups (group_id TEXT, type TEXT, PRIMARY KEY(group_id, type))")
        # YANGI: Dublikatlarni saqlash uchun alohida jadval (Beton himoya)
        cursor.execute("CREATE TABLE IF NOT EXISTS history (msg_unique_id TEXT PRIMARY KEY, date_added TIMESTAMP DEFAULT CURRENT_TIMESTAMP)")
        conn.commit()

# --- DUBLIKATNI BAZADAN TEKSHIRISH ---
def is_already_sent(unique_id):
    """Xabar avval yuborilganligini bazadan tekshiradi"""
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT 1 FROM history WHERE msg_unique_id = ?", (unique_id,))
        return cursor.fetchone() is not None

def mark_as_sent(unique_id):
    """Xabarni yuborilganlar ro'yxatiga qo'shadi"""
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        try:
            cursor.execute("INSERT INTO history (msg_unique_id) VALUES (?)", (unique_id,))
            conn.commit()
            # Bazani tozalab turish (oxirgi 1000 ta qolsin, baza shishib ketmasligi uchun)
            cursor.execute("DELETE FROM history WHERE msg_unique_id NOT IN (SELECT msg_unique_id FROM history ORDER BY date_added DESC LIMIT 1000)")
            conn.commit()
        except: pass

def clean_empty_keywords():
    """Bo'sh kalit so'zlarni o'chirib tashlaydi (Xatolik oldini olish uchun)"""
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM keywords WHERE length(word) < 2")
        conn.commit()

# --- BAZA FUNKSIYALARI ---
def db_add(table, value, type=None):
    """Ma'lumot qo'shish"""
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        try:
            if table == "groups": cursor.execute("INSERT INTO groups (group_id, type) VALUES (?, ?)", (value, type))
            elif table == "channels": cursor.execute("INSERT INTO channels (ident) VALUES (?)", (value,))
            elif table == "keywords": cursor.execute("INSERT INTO keywords (word) VALUES (?)", (value.lower(),))
            conn.commit()
            return True
        except sqlite3.IntegrityError:
            return False

def db_delete(table, value, type=None):
    """Ma'lumot o'chirish"""
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        if table == "groups": cursor.execute("DELETE FROM groups WHERE group_id = ? AND type = ?", (value, type))
        elif table == "channels": cursor.execute("DELETE FROM channels WHERE ident = ?", (value,))
        elif table == "keywords": cursor.execute("DELETE FROM keywords WHERE word = ?", (value.lower(),))
        conn.commit()
        return cursor.rowcount > 0

def db_get_list(table, type=None):
    """Ro'yxatni olish"""
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        if table == "groups": cursor.execute("SELECT group_id FROM groups WHERE type = ?", (type,))
        elif table == "channels": cursor.execute("SELECT ident FROM channels")
        elif table == "keywords": cursor.execute("SELECT word FROM keywords")
        return [row[0] for row in cursor.fetchall()]

# Ishga tushirishda bazani tayyorlash
init_db()
clean_empty_keywords()

def normalize_text(text):
    if not text: return ""
    text = str(text).lower()
    text = text.replace("‘", "'").replace("’", "'").replace("`", "'").replace("ʻ", "'").replace("ʼ", "'")
    text = text.replace("\u200b", "").replace("\xa0", " ")
    text = text.replace("\n", " ").replace("\r", " ").strip()
    return text

# ---------------- CLIENT ----------------
print(f"Userbot ({SESSION_NAME}) ishga tushdi...")
try:
    groq_client = AsyncGroq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None
    if groq_client:
        print(f"✅ Groq AI tayyor (Smart Filter). Model: {GROQ_MODEL}")
    else:
        print("⚠️ GROQ_API_KEY topilmadi. AI filtr ishlamaydi (hammasi SKIP/ERROR bo'ladi).")
except Exception as e:
    print(f"❌ Groq xatosi: {e}")
    groq_client = None

client = TelegramClient(SESSION_NAME, api_id, api_hash)
ALBUM_BUFFER = {}

# --- YANGI AQLLI AI ANALIZI ---
async def analyze_content_smart(text):
    """
    AI ga matnni beramiz. U o'zi hal qiladi:
    1. Bu O'zbekiston Temir Yo'llariga oidmi?
    2. Oid bo'lsa, kayfiyati qanday?
    """
    system_prompt = (
        "Sen professional tahlilchisan. Senga Telegram xabarlari yuboriladi (O'zbek, Rus, Ingliz tilida).\n"
        "Vazifang: Matn 'O'zbekiston Temir Yo'llari' (UTY), uning poyezdlari (Afrosiyob, Sharq, Nasaf), "
        "vokzallari, chiptalari yoki xizmatlariga aloqadorligini aniqlash.\n\n"
        "QOIDALAR:\n"
        "1. Agar matn O'zbekiston temir yo'llariga umuman aloqasiz bo'lsa (masalan, metro, avtobus, yoki chet el poyezdlari) -> Javob: 'SKIP'\n"
        "2. Agar aloqador bo'lsa, mazmunini tahlil qil va quyidagilardan birini qaytar:\n"
        "   - 'YAXSHI' (Ijobiy, maqtov, yangilik)\n"
        "   - 'YOMON' (Shikoyat, muammo, tanqid, kechikish)\n"
        "   - 'NEYTRAL' (Oddiy ma'lumot, savol)\n"
        "Javob faqat bitta so'z bo'lsin."
    )
    
    try:
        if not groq_client:
            return "ERROR"
        chat_completion = await groq_client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Matn: {text}"}
            ],
            model=GROQ_MODEL,
            temperature=0, 
            max_tokens=15
        )
        result = chat_completion.choices[0].message.content.strip().upper()
        # Ba'zan AI gap qo'shib yuboradi, faqat kerakli so'zni ajratamiz
        if "SKIP" in result: return "SKIP"
        if "YAXSHI" in result: return "YAXSHI"
        if "YOMON" in result: return "YOMON"
        if "NEYTRAL" in result: return "NEYTRAL"
        return "SKIP" # Tushunarsiz bo'lsa tashlab yubor
    except Exception as e:
        print(f"⚠️ AI Xatosi: {e}")
        return "ERROR"

async def send_final(source_chat, messages, text, unique_id):
    # 1. DUBLIKAT TEKSHIRUVI (Bazadan)
    if is_already_sent(unique_id):
        return

    # 2. KALIT SO'Z (Birlamchi filtr)
    clean = normalize_text(text)
    keywords = db_get_list("keywords")
    
    found_kw = None
    for k in keywords:
        if not k.strip(): continue
        if normalize_text(k) in clean:
            found_kw = k
            break
            
    if not found_kw: return

    # Bazaga belgilab qo'yamiz (AI ga borishidan oldin, qayta yubormaslik uchun)
    mark_as_sent(unique_id)

    print(f"🔍 AI tekshirmoqda (Signal: '{found_kw}')...")
    
    # 3. AI TAHLIL (Smart Filter)
    analyze_result = await analyze_content_smart(text[:2000])
    print(f"🤖 AI Xulosasi: {analyze_result}")

    if analyze_result == "SKIP" or analyze_result == "ERROR":
        return

    good = db_get_list("groups", "good")
    bad = db_get_list("groups", "bad")
    neu = db_get_list("groups", "neutral")
    
    targets, info = [], None
    if analyze_result == "YAXSHI": targets = good
    elif analyze_result == "YOMON": targets = bad
    elif analyze_result == "NEYTRAL": targets = neu; info = "🤖 Neytral."
    
    if not targets: return

    for tid in targets:
        try:
            dest_id = int(tid) if str(tid).lstrip('-').isdigit() else tid
            
            # Agar AI info bergan bo'lsa (Neytral), avval uni tashlaymiz
            if info: await client.send_message(dest_id, info)
            
            # --- YANGI FUNKSIYA: FORWARD YOKI MATN+LINK ---
            try:
                # 1. Avval oddiy Forward qilishga urinamiz
                await client.forward_messages(dest_id, messages, source_chat)
                print(f"🚀 Yuborildi (Forward): {dest_id}")
            except Exception as e:
                # 2. Agar Forward o'xshamasa (Restricted Content)
                print(f"⚠️ Forward muvaffaqiyatsiz (Restricted?), Matn+Link usuli qo'llanmoqda...")
                
                # Link yasash
                raw_id = str(source_chat)
                # Kanal ID sidan -100 ni olib tashlaymiz (Link to'g'ri ishlashi uchun)
                clean_id = raw_id[4:] if raw_id.startswith("-100") else raw_id
                
                # Xabar ID si
                msg_id = messages[0].id
                
                # Link formati: t.me/c/KANAL_ID/XABAR_ID (Yopiq kanallar uchun /c/ ishlatiladi)
                post_link = f"https://t.me/c/{clean_id}/{msg_id}"
                
                # Yangi formatlangan matn
                new_text = f"{text}\n\n🔗 Manba: {post_link}"
                
                # Link previewni o'chirib yuboramiz
                await client.send_message(dest_id, new_text, link_preview=False)
                print(f"🚀 Yuborildi (Matn+Link): {dest_id}")

        except Exception as e:
            print(f"❌ Xato {tid}: {e}")

async def process_album_logic(chat_id, grouped_id):
    """4 soniya kutib, albomni yuboradi"""
    await asyncio.sleep(4)
    data = ALBUM_BUFFER.get(grouped_id)
    if not data: return
    
    msg_ids = data['ids']
    msgs = await client.get_messages(chat_id, ids=msg_ids)
    if not msgs: return

    full_text = ""
    for m in msgs:
        if m and m.text:
            if len(m.text) > len(full_text): full_text = m.text
    
    # Noyob ID: ChatID_AlbomID
    unique_id = f"{chat_id}_album_{grouped_id}"
    
    if full_text.strip():
        valid_msgs = [m for m in msgs if m is not None]
        await send_final(chat_id, valid_msgs, full_text, unique_id)
    
    if grouped_id in ALBUM_BUFFER: del ALBUM_BUFFER[grouped_id]

# --- HANDLER: Xabarlarni Tutish ---
@client.on(events.NewMessage)
@client.on(events.MessageEdited)
async def handler(event):
    chat = await event.get_chat()
    chat_id = str(chat.id)
    
    target_channels = db_get_list("channels")
    
    is_target = False
    if chat_id in target_channels: is_target = True
    if hasattr(chat, 'username') and chat.username and chat.username in target_channels: is_target = True
    if not is_target and str(chat.id).startswith("-100") and str(chat.id)[4:] in target_channels: is_target = True

    if not is_target: return

    # 1. ALBOM (GROUPED)
    if event.grouped_id:
        gid = event.grouped_id
        # Darhol tekshiramiz, agar bu albom bazada bo'lsa, buferga ham olish shart emas
        unique_id = f"{event.chat_id}_album_{gid}"
        if is_already_sent(unique_id): return

        if gid not in ALBUM_BUFFER:
            ALBUM_BUFFER[gid] = {'ids': [], 'task': None}
        
        if event.id not in ALBUM_BUFFER[gid]['ids']:
            ALBUM_BUFFER[gid]['ids'].append(event.id)
        
        if ALBUM_BUFFER[gid]['task']: ALBUM_BUFFER[gid]['task'].cancel()
        ALBUM_BUFFER[gid]['task'] = asyncio.create_task(process_album_logic(event.chat_id, gid))
        return

    # 2. ODDIY XABAR
    else:
        text = event.message.text
        if not text: return
        
        # Noyob ID: ChatID_MessageID
        unique_id = f"{event.chat_id}_msg_{event.id}"
        
        await send_final(event.chat_id, [event.message], text, unique_id)

# --- BUYRUQLAR (O'zgarishsiz) ---

@client.on(events.NewMessage(outgoing=True, pattern=r"(?i)^\.id$"))
async def cmd_id(event):
    await event.edit(f"🆔 ID: `{event.chat_id}`")

@client.on(events.NewMessage(outgoing=True, pattern=r"(?i)^\.(add|del) (\w+) ?(.*)"))
async def cmd_manage(event):
    args = event.pattern_match
    action = args.group(1)
    category = args.group(2)
    value = args.group(3)

    if not value:
        await event.edit("❌ Xato! Namuna:\n`.add ch -100xxx`\n`.add kw poyezd`\n`.add group good -100xxx`")
        return

    if category == "ch":
        val = value.replace("https://t.me/", "").replace("@", "")
        if action == "add":
            if db_add("channels", val): await event.edit(f"✅ Kanal qo'shildi: `{val}`")
            else: await event.edit("⚠️ Bor.")
        else:
            if db_delete("channels", val): await event.edit(f"🗑 O'chirildi: `{val}`")
            else: await event.edit("⚠️ Topilmadi.")

    elif category == "kw":
        val = value
        if action == "add":
            if db_add("keywords", val): await event.edit(f"✅ So'z qo'shildi: `{val}`")
            else: await event.edit("⚠️ Bor.")
        else:
            if db_delete("keywords", val): await event.edit(f"🗑 O'chirildi: `{val}`")
            else: await event.edit("⚠️ Topilmadi.")
    
    elif category == "group":
        parts = value.split()
        if len(parts) < 2:
            await event.edit("❌ Xato. Namuna: `.add group good -100123`")
            return
        g_type = parts[0]
        g_id = parts[1]
        
        if g_type not in ["good", "bad", "neutral"]:
            await event.edit("❌ Turini kiriting: good, bad, neutral")
            return

        if action == "add":
            if db_add("groups", g_id, g_type): await event.edit(f"✅ {g_type.upper()} qo'shildi: `{g_id}`")
            else: await event.edit("⚠️ Bor.")
        else:
            if db_delete("groups", g_id, g_type): await event.edit(f"🗑 O'chirildi: `{g_id}`")
            else: await event.edit("⚠️ Topilmadi.")

@client.on(events.NewMessage(outgoing=True, pattern=r"(?i)^\.list$"))
async def cmd_list(event):
    chs = db_get_list("channels")
    kws = db_get_list("keywords")
    good = db_get_list("groups", "good")
    bad = db_get_list("groups", "bad")
    neu = db_get_list("groups", "neutral")

    def format_list(lst):
        return f"`{', '.join(lst)}`" if lst else "_Bo'sh_"

    text = (
        f"📊 **BOT SOZLAMALARI:**\n\n"
        f"📢 **Kuzatilayotgan Kanallar ({len(chs)} ta):**\n{format_list(chs)}\n\n"
        f"🔑 **Kalit so'zlar ({len(kws)} ta):**\n{format_list(kws)}\n\n"
        f"🟢 **Yaxshi guruhlar:**\n{format_list(good)}\n\n"
        f"🔴 **Yomon guruhlar:**\n{format_list(bad)}\n\n"
        f"⚪️ **Neytral/Xato:**\n{format_list(neu)}"
    )
    await event.edit(text)

with client:
    client.run_until_disconnected()