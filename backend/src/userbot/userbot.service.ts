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
  private authClients: Map<string, any> = new Map();

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

    if (!apiIdStr || !apiHash) {
      return;
    }

    const apiId = parseInt(apiIdStr, 10);
    if (isNaN(apiId)) return;

    let sessionStr = await this.db.getSetting('telegram_session');
    if (!sessionStr) {
      sessionStr = process.env.TELEGRAM_STRING_SESSION || '';
    }

    if (!sessionStr || !sessionStr.trim()) {
      this.isConnected = false;
      this.botInfo = null;
      return;
    }

    try {
      if (this.client) {
        try {
          await this.client.disconnect();
        } catch {}
        this.client = null;
      }

      const session = new StringSession(sessionStr.trim());
      await session.load();

      this.client = new TelegramClient(session, apiId, apiHash.trim(), {
        connectionRetries: 3,
      });

      await this.client.connect();
      const me = await this.client.getMe();
      if (!me) {
        this.isConnected = false;
        this.botInfo = null;
        return;
      }

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
      console.error('Telegram ulanish xatosi:', err?.message || err);
      this.isConnected = false;
      this.botInfo = null;
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
      } catch { }
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
      } catch { }
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

  async sendAuthCode(phone: string): Promise<any> {
    const apiIdStr = process.env.TELEGRAM_API_ID;
    const apiHash = process.env.TELEGRAM_API_HASH;
    if (!apiIdStr || !apiHash) {
      throw new Error('TELEGRAM_API_ID yoki TELEGRAM_API_HASH topilmadi');
    }
    const apiId = parseInt(apiIdStr, 10);
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '').trim();

    const authClient = new TelegramClient(new StringSession(''), apiId, apiHash.trim(), {
      connectionRetries: 5,
    });
    await authClient.connect();

    const res = await authClient.sendCode(
      { apiId, apiHash: apiHash.trim() },
      cleanPhone,
    );

    this.authClients.set(cleanPhone, {
      client: authClient,
      phoneCodeHash: res.phoneCodeHash,
      createdAt: Date.now(),
    });

    return {
      phone: cleanPhone,
      phoneCodeHash: res.phoneCodeHash,
    };
  }

  async verifyAuthCode(phone: string, code: string, phoneCodeHash: string, password?: string): Promise<any> {
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '').trim();
    const entry = this.authClients.get(cleanPhone);
    let authClient = entry?.client;

    if (!authClient) {
      const apiIdStr = process.env.TELEGRAM_API_ID;
      const apiHash = process.env.TELEGRAM_API_HASH;
      if (!apiIdStr || !apiHash) {
        throw new Error('TELEGRAM_API_ID yoki TELEGRAM_API_HASH topilmadi');
      }
      const apiId = parseInt(apiIdStr, 10);
      authClient = new TelegramClient(new StringSession(''), apiId, apiHash.trim(), {
        connectionRetries: 5,
      });
      await authClient.connect();
    }

    try {
      await authClient.signIn({
        phoneNumber: cleanPhone,
        phoneCodeHash: phoneCodeHash || entry?.phoneCodeHash,
        phoneCode: code.trim(),
      });
    } catch (err: any) {
      if (err.errorMessage === 'SESSION_PASSWORD_NEEDED') {
        if (!password) {
          return { needPassword: true };
        }
        await authClient.signInWithPassword({
          password: password.trim(),
        });
      } else {
        throw err;
      }
    }

    const sessionString = authClient.session.save();
    this.authClients.delete(cleanPhone);

    await this.db.setSetting('telegram_session', sessionString);
    await this.initTelegram();

    return {
      success: true,
      connected: this.isConnected,
      botUser: this.botInfo,
    };
  }

  async disconnectBot(): Promise<any> {
    if (this.client) {
      try {
        await this.client.disconnect();
      } catch {}
      this.client = null;
    }
    this.isConnected = false;
    this.botInfo = null;
    await this.db.deleteSetting('telegram_session');
    return { success: true };
  }

  async reconnectBot(): Promise<any> {
    await this.initTelegram();
    return this.getStatus();
  }

  async checkChannelsSync(): Promise<any> {
    const dbChannels = await this.db.getChannels();
    const dbGroups = await this.db.getGroups();

    if (!this.client || !this.isConnected) {
      return {
        connected: false,
        totalChannels: dbChannels.length,
        joinedChannels: 0,
        missingChannels: dbChannels,
        totalGroups: dbGroups.length,
        joinedGroups: 0,
        missingGroups: dbGroups,
      };
    }

    try {
      const dialogs = await this.client.getDialogs({});
      const joinedUsernamesOrIds = new Set<string>();

      for (const d of dialogs) {
        if (d.entity) {
          if (d.entity.username) {
            joinedUsernamesOrIds.add(d.entity.username.toLowerCase());
          }
          if (d.entity.id) {
            const strId = d.entity.id.toString();
            joinedUsernamesOrIds.add(strId);
            joinedUsernamesOrIds.add(`-100${strId}`);
            joinedUsernamesOrIds.add(`-${strId}`);
          }
        }
        if (d.id) {
          const strId = d.id.toString();
          joinedUsernamesOrIds.add(strId);
          joinedUsernamesOrIds.add(`-100${strId}`);
          joinedUsernamesOrIds.add(`-${strId}`);
        }
      }

      const missingChannels = dbChannels.filter((ch: string) => {
        const clean = ch.replace('https://t.me/', '').replace('@', '').toLowerCase().trim();
        return !joinedUsernamesOrIds.has(clean);
      });

      const missingGroups = dbGroups.filter((gr: any) => {
        const id = gr.group_id.toString().trim();
        return !joinedUsernamesOrIds.has(id);
      });

      return {
        connected: true,
        totalChannels: dbChannels.length,
        joinedChannels: dbChannels.length - missingChannels.length,
        missingChannels,
        totalGroups: dbGroups.length,
        joinedGroups: dbGroups.length - missingGroups.length,
        missingGroups,
      };
    } catch (err: any) {
      return {
        connected: this.isConnected,
        error: err?.message || 'Dialoglarni yuklashda xatolik',
        totalChannels: dbChannels.length,
        joinedChannels: 0,
        missingChannels: dbChannels,
        totalGroups: dbGroups.length,
        joinedGroups: 0,
        missingGroups: dbGroups,
      };
    }
  }

  private getRandomDelay(min: number = 3500, max: number = 6500): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise((r) => setTimeout(r, delay));
  }

  async autoJoinChannels(): Promise<any> {
    if (!this.client || !this.isConnected) {
      throw new Error('Telegram mijoz faol emas');
    }

    const sync = await this.checkChannelsSync();
    const channelsToJoin = sync.missingChannels || [];
    const groupsToJoin = sync.missingGroups || [];

    const results: any[] = [];
    let successCount = 0;
    let failCount = 0;
    let totalProcessed = 0;

    for (const ch of channelsToJoin) {
      const clean = ch.replace('https://t.me/', '').replace('@', '').trim();
      try {
        const entity = await this.client.getEntity(clean);
        await this.client.invoke(new Api.channels.JoinChannel({ channel: entity }));
        successCount++;
        results.push({ item: ch, status: 'success' });
      } catch (err: any) {
        failCount++;
        const errMsg = err?.errorMessage || err?.message || 'Xatolik';
        results.push({ item: ch, status: 'error', error: errMsg });
        if (err?.seconds || errMsg.includes('FLOOD_WAIT')) {
          const waitSec = err?.seconds || 30;
          await new Promise((r) => setTimeout(r, Math.min(waitSec * 1000, 60000)));
        }
      }

      totalProcessed++;
      if (totalProcessed % 10 === 0) {
        await this.getRandomDelay(12000, 18000);
      } else {
        await this.getRandomDelay(3500, 6500);
      }
    }

    for (const gr of groupsToJoin) {
      const id = gr.group_id.trim();
      try {
        const entity = await this.client.getEntity(id);
        await this.client.invoke(new Api.channels.JoinChannel({ channel: entity }));
        successCount++;
        results.push({ item: id, status: 'success' });
      } catch (err: any) {
        failCount++;
        const errMsg = err?.errorMessage || err?.message || 'Xatolik';
        results.push({ item: id, status: 'error', error: errMsg });
        if (err?.seconds || errMsg.includes('FLOOD_WAIT')) {
          const waitSec = err?.seconds || 30;
          await new Promise((r) => setTimeout(r, Math.min(waitSec * 1000, 60000)));
        }
      }

      totalProcessed++;
      if (totalProcessed % 10 === 0) {
        await this.getRandomDelay(12000, 18000);
      } else {
        await this.getRandomDelay(3500, 6500);
      }
    }

    const newSync = await this.checkChannelsSync();

    return {
      success: true,
      joined: successCount,
      failed: failCount,
      results,
      sync: newSync,
    };
  }
}

