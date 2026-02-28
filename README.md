# userbotForAnalyzeWithKeywords

Telegram **userbot** (Telethon) that watches selected channels, applies a **keyword pre-filter**, then uses **Groq LLM** to classify messages related to **O'zbekiston Temir Yo'llari (UTY)** and routes them to different target groups.

## What it does

- Watches specific Telegram channels (by id / username)
- Checks message text for any configured keywords (fast filter)
- If a keyword matches, sends the text to Groq AI for classification:
  - `SKIP` (not related to UTY)
  - `YAXSHI` (positive)
  - `YOMON` (complaint/negative)
  - `NEYTRAL` (neutral / question)
- Forwards the original message to configured groups/chats
  - If forwarding is restricted, sends **text + source link** instead
- Prevents duplicates using SQLite (`history` table)

## Requirements

- Python 3.10+ (recommended)
- Telegram API credentials (from https://my.telegram.org)
- Groq API key (from https://console.groq.com)

## Install

1) Create and activate a virtual environment (Windows PowerShell):

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

2) Install packages:

```powershell
pip install -r requirements.txt
```

## Configure (env vars)

This project reads secrets from environment variables. Set them before running:

### Windows PowerShell (current session)

```powershell
$env:TELEGRAM_API_ID = "YOUR_API_ID"
$env:TELEGRAM_API_HASH = "YOUR_API_HASH"
$env:GROQ_API_KEY = "YOUR_GROQ_KEY"
```

### Linux / macOS (bash)

```bash
export TELEGRAM_API_ID="YOUR_API_ID"
export TELEGRAM_API_HASH="YOUR_API_HASH"
export GROQ_API_KEY="YOUR_GROQ_KEY"
```

Optional:

- `GROQ_MODEL` (default: `llama-3.3-70b-versatile`)

## Run

```powershell
python main.py
```

On first run, Telethon will ask for your phone number and login code and will create a session file locally.

## Bot commands (send from your own account)

The bot listens to your outgoing messages and supports these commands:

- Show current chat id:
  - `.id`
- Add / delete watched channel:
  - `.add ch -1001234567890`
  - `.add ch @channelusername`
  - `.del ch -1001234567890`
- Add / delete keyword:
  - `.add kw afrosiyob`
  - `.del kw afrosiyob`
- Add / delete target groups by sentiment:
  - `.add group good -1001111111111`
  - `.add group bad -1002222222222`
  - `.add group neutral -1003333333333`
  - `.del group good -1001111111111`
- List current configuration:
  - `.list`

## Data files (local only)

These files are created locally and should not be committed:

- `telethon_userbot.session` (Telethon login session)
- `bot_data.db` (SQLite: channels/keywords/groups/history)

## Notes / safety

- Do not commit API keys or session files.
- If you previously exposed credentials, rotate them (Telegram API hash / Groq key).
