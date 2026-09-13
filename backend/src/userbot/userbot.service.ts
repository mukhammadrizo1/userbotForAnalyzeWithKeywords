import { Injectable, OnModuleInit } from '@nestjs/common';
import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { NewMessage } from 'telegram/events';
import Groq from 'groq-sdk';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class UserbotService implements OnModuleInit {
  private client: any = null;
  private groqClients: any[] = [];
  private currentGroqIndex = 0;
  private albumBuffer: Map<string, any> = new Map();
  private isConnected = false;
  private botInfo: any = null;
  private startTime = Date.now();

  constructor(private readonly db: DatabaseService) {}

  async onModuleInit() {
    this.initGroq();
    await this.initTelegram();
  }

  private initGroq() {
    const raw = process.env.GROQ_API_KEY || '';
    const keys = raw
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
    this.groqClients = keys
      .map((k) => {
        try {
          return new Groq({ apiKey: k });
        } catch {
          return null;
        }
      })
      .filter((c) => c !== null);
  }


  private async initTelegram() {
    const apiIdStr = process.env.TELEGRAM_API_ID;
    const apiHash = process.env.TELEGRAM_API_HASH;
    const sessionStr = process.env.TELEGRAM_STRING_SESSION;

    if (!apiIdStr || !apiHash || !sessionStr) {
      return;
    }

    const apiId = parseInt(apiIdStr, 10);
    if (isNaN(apiId)) return;

    try {
      const session = new StringSession(sessionStr.trim());
      await session.load();

      this.client = new TelegramClient(session, apiId, apiHash.trim(), {
        connectionRetries: 5,
      });

      await this.client.connect();
      const me = await this.client.getMe();
      this.botInfo = {
        id: me?.id ? me.id.toString() : null,
        firstName: me?.firstName || '',
        lastName: me?.lastName || '',
        username: me?.username || '',
        phone: me?.phone || '',
      };
      this.isConnected = true;

      this.registerHandlers();
    } catch (err: any) {
      this.isConnected = false;
    }
  }

  private registerHandlers() {
    if (!this.client) return;

    this.client.addEventHandler(async (event: any) => {
      try {
        const message = event.message;
        if (!message) return;

        if (message.out && message.message) {
          await this.handleOutgoingCommand(event);
        }

        await this.handleIncomingMessage(event);
      } catch {}
    }, new NewMessage({}));
  }

  private async handleOutgoingCommand(event: any) {
    const msg = event.message;
    const text = (msg.message || '').trim();

    if (/^\.id$/i.test(text)) {
      const peerId = event.chatId ? event.chatId.toString() : '';
      await event.message.edit({ text: `🆔 ID: \`${peerId}\`` });
      return;
    }

    const manageMatch = text.match(/^\.(add|del)\s+(\w+)\s*(.*)$/i);
    if (manageMatch) {
      const action = manageMatch[1].toLowerCase();
      const category = manageMatch[2].toLowerCase();
      const value = (manageMatch[3] || '').trim();

      if (!value) {
        await event.message.edit({
          text: '❌ Xato! Namuna:\n`.add ch -100xxx`\n`.add kw poyezd`\n`.add group good -100xxx`',
        });
        return;
      }

      if (category === 'ch') {
        const clean = value.replace('https://t.me/', '').replace('@', '');
        if (action === 'add') {
          const ok = await this.db.addChannel(clean);
          await event.message.edit({ text: ok ? `✅ Kanal qo'shildi: \`${clean}\`` : '⚠️ Bor.' });
        } else {
          const ok = await this.db.deleteChannel(clean);
          await event.message.edit({ text: ok ? `🗑 O'chirildi: \`${clean}\`` : '⚠️ Topilmadi.' });
        }
      } else if (category === 'kw') {
        if (action === 'add') {
          const ok = await this.db.addKeyword(value);
          await event.message.edit({ text: ok ? `✅ So'z qo'shildi: \`${value}\`` : '⚠️ Bor.' });
        } else {
          const ok = await this.db.deleteKeyword(value);
          await event.message.edit({ text: ok ? `🗑 O'chirildi: \`${value}\`` : '⚠️ Topilmadi.' });
        }
      } else if (category === 'group') {
        const parts = value.split(/\s+/);
        if (parts.length < 2) {
          await event.message.edit({ text: '❌ Xato. Namuna: `.add group good -100123`' });
          return;
        }
        const gType = parts[0].toLowerCase();
        const gId = parts[1];
        if (!['good', 'bad', 'neutral'].includes(gType)) {
          await event.message.edit({ text: '❌ Turini kiriting: good, bad, neutral' });
          return;
        }
        if (action === 'add') {
          const ok = await this.db.addGroup(gId, gType);
          await event.message.edit({ text: ok ? `✅ ${gType.toUpperCase()} qo'shildi: \`${gId}\`` : '⚠️ Bor.' });
        } else {
          const ok = await this.db.deleteGroup(gId, gType);
          await event.message.edit({ text: ok ? `🗑 O'chirildi: \`${gId}\`` : '⚠️ Topilmadi.' });
        }
      }
      return;
    }

    if (/^\.list$/i.test(text)) {
      const [chs, kws, good, bad, neu] = await Promise.all([
        this.db.getChannels(),
        this.db.getKeywords(),
        this.db.getGroups('good'),
        this.db.getGroups('bad'),
        this.db.getGroups('neutral'),
      ]);

      const fmt = (arr: any[]) => (arr && arr.length > 0 ? `\`${arr.join(', ')}\`` : '_Boʻsh_');
      const fmtG = (arr: any[]) => (arr && arr.length > 0 ? `\`${arr.map((x: any) => x.group_id).join(', ')}\`` : '_Boʻsh_');

      const response =
        `📊 **BOT SOZLAMALARI:**\n\n` +
        `📢 **Kuzatilayotgan Kanallar (${chs.length} ta):**\n${fmt(chs)}\n\n` +
        `🔑 **Kalit so'zlar (${kws.length} ta):**\n${fmt(kws)}\n\n` +
        `🟢 **Yaxshi guruhlar:**\n${fmtG(good)}\n\n` +
        `🔴 **Yomon guruhlar:**\n${fmtG(bad)}\n\n` +
        `⚪️ **Neytral/Xato:**\n${fmtG(neu)}`;

      await event.message.edit({ text: response });
    }
  }

  private async handleIncomingMessage(event: any) {
    const chat = await event.getChat();
    if (!chat) return;

    const chatId = chat.id ? chat.id.toString() : '';
    const username = chat.username || '';
    const targetChannels = await this.db.getChannels();

    let isTarget = false;
    if (targetChannels.includes(chatId)) isTarget = true;
    if (username && targetChannels.includes(username)) isTarget = true;
    if (!isTarget && chatId.startsWith('-100') && targetChannels.includes(chatId.slice(4))) isTarget = true;

    if (!isTarget) return;

    const msg = event.message;
    if (!msg) return;

    if (msg.groupedId) {
      const gid = msg.groupedId.toString();
      const uniqueId = `${chatId}_album_${gid}`;
      if (await this.db.isAlreadySent(uniqueId)) return;

      if (!this.albumBuffer.has(gid)) {
        this.albumBuffer.set(gid, { ids: [], chatId, task: null });
      }
      const data = this.albumBuffer.get(gid);
      if (!data.ids.includes(msg.id)) {
        data.ids.push(msg.id);
      }
      if (data.task) clearTimeout(data.task);

      data.task = setTimeout(async () => {
        await this.processAlbumLogic(chatId, gid);
      }, 4000);
      return;
    }

    const text = msg.message || '';
    if (!text) return;

    const uniqueId = `${chatId}_msg_${msg.id}`;
    await this.sendFinal(chatId, [msg], text, uniqueId, username || chatId);
  }

  private async processAlbumLogic(chatId: string, groupedId: string) {
    const data = this.albumBuffer.get(groupedId);
    if (!data) return;

    const msgs = await this.client.getMessages(chatId, { ids: data.ids });
    if (!msgs || msgs.length === 0) return;

    let longestText = '';
    for (const m of msgs) {
      if (m && m.message && m.message.length > longestText.length) {
        longestText = m.message;
      }
    }

    const uniqueId = `${chatId}_album_${groupedId}`;
    if (longestText.trim()) {
      const validMsgs = msgs.filter((m: any) => m !== null && m !== undefined);
      await this.sendFinal(chatId, validMsgs, longestText, uniqueId, chatId);
    }
    this.albumBuffer.delete(groupedId);
  }

  private async sendFinal(sourceChat: string, messages: any[], text: string, uniqueId: string, channelName: string) {
    if (await this.db.isAlreadySent(uniqueId)) return;

    const clean = this.normalizeText(text);
    const keywords = await this.db.getKeywords();

    let foundKw = null;
    for (const k of keywords) {
      if (!k.trim()) continue;
      if (clean.includes(this.normalizeText(k))) {
        foundKw = k;
        break;
      }
    }

    if (!foundKw) return;

    await this.db.markAsSent(uniqueId, text.slice(0, 500), 'PENDING', channelName, 'PROCESSING');

    const analyzeResult = await this.analyzeContentSmart(text.slice(0, 2000));
    if (analyzeResult === 'SKIP' || analyzeResult === 'ERROR') {
      await this.db.markAsSent(uniqueId, text.slice(0, 500), analyzeResult, channelName, 'SKIPPED');
      return;
    }

    let targetGroups: any[] = [];
    let info = '';

    if (analyzeResult === 'YAXSHI') {
      targetGroups = await this.db.getGroups('good');
    } else if (analyzeResult === 'YOMON') {
      targetGroups = await this.db.getGroups('bad');
    } else if (analyzeResult === 'NEYTRAL') {
      targetGroups = await this.db.getGroups('neutral');
      info = '🤖 Neytral.';
    }

    if (!targetGroups || targetGroups.length === 0) return;

    const msgIds = messages.map((m: any) => m.id);

    for (const target of targetGroups) {
      const destId = target.group_id;
      try {
        if (info) {
          await this.client.sendMessage(destId, { message: info });
        }

        try {
          await this.client.forwardMessages(destId, {
            messages: msgIds,
            fromPeer: sourceChat,
          });
        } catch {
          const rawId = sourceChat.toString();
          const cleanId = rawId.startsWith('-100') ? rawId.slice(4) : rawId;
          const msgId = msgIds[0];
          const postLink = `https://t.me/c/${cleanId}/${msgId}`;
          const newText = `${text}\n\n🔗 Manba: ${postLink}`;
          await this.client.sendMessage(destId, {
            message: newText,
            linkPreview: false,
          });
        }
      } catch {}
    }

    await this.db.markAsSent(uniqueId, text.slice(0, 500), analyzeResult, channelName, 'SENT');
  }

  private async analyzeContentSmart(text: string): Promise<string> {
    if (!this.groqClients || this.groqClients.length === 0) return 'ERROR';

    const systemPrompt = `Sen professional tahlilchisan. Senga Telegram xabarlari yuboriladi (O'zbek, Rus, Ingliz tilida).
Vazifang: Matn 'O'zbekiston Temir Yo'llari' (UTY), uning poyezdlari (Afrosiyob, Sharq, Nasaf), vokzallari, chiptalari yoki xizmatlariga aloqadorligini aniqlash.

QOIDALAR:
1. Agar matn O'zbekiston temir yo'llariga umuman aloqasiz bo'lsa (masalan, metro, avtobus, yoki chet el poyezdlari) -> Javob: 'SKIP'
2. Agar aloqador bo'lsa, mazmunini tahlil qil va quyidagilardan birini qaytar:
   - 'YAXSHI' (Ijobiy, maqtov, yangilik)
   - 'YOMON' (Shikoyat, muammo, tanqid, kechikish)
   - 'NEYTRAL' (Oddiy ma'lumot, savol)
Javob faqat bitta so'z bo'lsin.`;

    const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

    for (let attempt = 0; attempt < this.groqClients.length; attempt++) {
      const client = this.groqClients[this.currentGroqIndex];
      this.currentGroqIndex = (this.currentGroqIndex + 1) % this.groqClients.length;

      try {
        const completion = await client.chat.completions.create({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Matn: ${text}` },
          ],
          model,
          temperature: 0,
          max_tokens: 15,
        });

        const result = (completion.choices[0]?.message?.content || '').trim().toUpperCase();
        if (result.includes('SKIP')) return 'SKIP';
        if (result.includes('YAXSHI')) return 'YAXSHI';
        if (result.includes('YOMON')) return 'YOMON';
        if (result.includes('NEYTRAL')) return 'NEYTRAL';
        return 'SKIP';
      } catch {
        continue;
      }
    }
    return 'ERROR';
  }

  private normalizeText(text: string): string {
    if (!text) return '';
    return text
      .toLowerCase()
      .replace(/[‘'`ʻʼ]/g, "'")
      .replace(/\u200b/g, '')
      .replace(/\xa0/g, ' ')
      .replace(/[\n\r]+/g, ' ')
      .trim();
  }

  async getStatus(): Promise<any> {
    const counts = await this.db.getCounts();
    return {
      connected: this.isConnected,
      botUser: this.botInfo,
      groqReady: this.groqClients.length > 0,
      groqKeysCount: this.groqClients.length,
      groqModel: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      stats: counts,
    };
  }
}

