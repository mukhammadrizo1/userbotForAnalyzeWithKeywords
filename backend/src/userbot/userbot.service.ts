import { Injectable, OnModuleInit } from '@nestjs/common';
import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { NewMessage } from 'telegram/events';
import Groq from 'groq-sdk';
import { DatabaseService } from '../database/database.service';
import { LoggerService } from '../logger/logger.service';

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

  constructor(
    private readonly db: DatabaseService,
    private readonly logger: LoggerService,
  ) { }

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
        } catch { }
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
        this.logger.warn('telegram', 'Telegram ulandi, lekin getMe() ma\'lumot qaytarmadi');
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
      this.logger.success('telegram', `Telegram userbot muvaffaqiyatli ulandi: ${this.botInfo.firstName} (@${this.botInfo.username || this.botInfo.phone || this.botInfo.id})`);

      this.registerHandlers();
    } catch (err: any) {
      this.logger.error('telegram', `Telegram ulanish xatosi: ${err?.message || err}`);
      console.error('Telegram ulanish xatosi:', err?.message || err);
      this.isConnected = false;
      this.botInfo = null;
    }
  }

  private getNormalizedIdVariants(id: any): string[] {
    if (!id) return [];
    const str = id.toString().trim();
    const digits = str.replace(/[^0-9]/g, '');
    if (!digits) return [str.toLowerCase()];
    return [
      digits,
      `-${digits}`,
      `-100${digits}`,
    ];
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
      } catch (err: any) {
        this.logger.error('telegram', `Xabarni qayta ishlashda kutilmagan xatolik: ${err?.message || err}`);
      }
    }, new NewMessage({}));
    this.logger.info('telegram', 'Xabarlarni tinglash xizmati (NewMessage) faollashtirildi');
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
    const msg = event.message;
    if (!msg) return;

    const text = (msg.message || msg.text || '').trim();
    if (!text) return;

    const rawChatId = event.chatId ? event.chatId.toString() : '';
    let chat = event.chat;
    if (!chat && typeof event.getChat === 'function') {
      try {
        chat = await event.getChat();
      } catch { }
    }

    const peerChannelId = msg.peerId?.channelId ? msg.peerId.channelId.toString() : '';
    const peerChatId = msg.peerId?.chatId ? msg.peerId.chatId.toString() : '';
    const chatEntityId = chat?.id ? chat.id.toString() : '';
    const username = (chat?.username || '').toLowerCase().trim();
    const chatTitle = chat?.title || (username ? `@${username}` : null) || rawChatId || 'Noma\'lum chat';

    const targetChannels = await this.db.getChannels();
    if (!targetChannels || targetChannels.length === 0) return;

    // Build incoming chat ID variants
    const incomingVariants = new Set<string>();
    if (rawChatId) this.getNormalizedIdVariants(rawChatId).forEach((v) => incomingVariants.add(v));
    if (peerChannelId) this.getNormalizedIdVariants(peerChannelId).forEach((v) => incomingVariants.add(v));
    if (peerChatId) this.getNormalizedIdVariants(peerChatId).forEach((v) => incomingVariants.add(v));
    if (chatEntityId) this.getNormalizedIdVariants(chatEntityId).forEach((v) => incomingVariants.add(v));
    if (username) {
      incomingVariants.add(username);
      incomingVariants.add(`@${username}`);
    }

    let matchedChannel: string | null = null;
    for (const ch of targetChannels) {
      const clean = ch.replace('https://t.me/', '').replace('@', '').toLowerCase().trim();
      if (incomingVariants.has(clean)) {
        matchedChannel = ch;
        break;
      }
      const variants = this.getNormalizedIdVariants(clean);
      if (variants.some((v) => incomingVariants.has(v))) {
        matchedChannel = ch;
        break;
      }
    }

    if (!matchedChannel) {
      return;
    }

    this.logger.info(
      'telegram',
      `Kuzatilayotgan kanaldan yangi xabar keldi: "${chatTitle}" (Mos kanal: ${matchedChannel})`,
      { preview: text.slice(0, 120), chatId: rawChatId || chatEntityId },
    );

    const effectiveChatId = rawChatId || (peerChannelId ? `-100${peerChannelId}` : chatEntityId);

    if (msg.groupedId) {
      const gid = msg.groupedId.toString();
      const uniqueId = `${effectiveChatId}_album_${gid}`;
      if (await this.db.isAlreadySent(uniqueId)) return;

      if (!this.albumBuffer.has(gid)) {
        this.albumBuffer.set(gid, { ids: [], chatId: effectiveChatId, task: null, channelName: chatTitle });
      }
      const data = this.albumBuffer.get(gid);
      if (!data.ids.includes(msg.id)) {
        data.ids.push(msg.id);
      }
      if (data.task) clearTimeout(data.task);

      data.task = setTimeout(async () => {
        await this.processAlbumLogic(effectiveChatId, gid, chatTitle);
      }, 4000);
      return;
    }

    const uniqueId = `${effectiveChatId}_msg_${msg.id}`;
    await this.sendFinal(effectiveChatId, [msg], text, uniqueId, chatTitle);
  }

  private async processAlbumLogic(chatId: string, groupedId: string, channelName?: string) {
    const data = this.albumBuffer.get(groupedId);
    if (!data) return;

    try {
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
        await this.sendFinal(chatId, validMsgs, longestText, uniqueId, channelName || chatId);
      }
    } catch (err: any) {
      this.logger.error('telegram', `Albomni qayta ishlashda xatolik: ${err?.message || err}`);
    } finally {
      this.albumBuffer.delete(groupedId);
    }
  }

  private async sendFinal(sourceChat: string, messages: any[], text: string, uniqueId: string, channelName: string) {
    if (await this.db.isAlreadySent(uniqueId)) {
      this.logger.info('telegram', `Xabar allaqachon qayta ishlangan: ${uniqueId}`);
      return;
    }

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

    if (!foundKw) {
      this.logger.info(
        'telegram',
        `Xabarda kalit so'zlar topilmadi: "${text.slice(0, 60)}..." (Bazada ${keywords.length} ta kalit so'z bor)`,
      );
      return;
    }

    this.logger.success('telegram', `Kalit so'z topildi: "${foundKw}" | Kanal: "${channelName}"`);

    await this.db.markAsSent(uniqueId, text.slice(0, 500), 'PENDING', channelName, 'PROCESSING');

    this.logger.info('groq', `AI tahlili boshlandi... Xabar: "${text.slice(0, 80)}..."`);
    const analyzeResult = await this.analyzeContentSmart(text.slice(0, 2000));
    this.logger.info('groq', `AI tahlil natijasi: ${analyzeResult}`);

    if (analyzeResult === 'SKIP' || analyzeResult === 'ERROR') {
      await this.db.markAsSent(uniqueId, text.slice(0, 500), analyzeResult, channelName, 'SKIPPED');
      this.logger.warn('groq', `Xabar o'tkazib yuborildi (Natija: ${analyzeResult}). Guruhga yuborilmaydi.`);
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
      info = '🤖 Neytral xabar.';
    }

    if (!targetGroups || targetGroups.length === 0) {
      this.logger.warn('forward', `"${analyzeResult}" toifasi uchun birorta ham guruh topilmadi.`);
      await this.db.markAsSent(uniqueId, text.slice(0, 500), analyzeResult, channelName, 'NO_GROUP');
      return;
    }

    const msgIds = messages.map((m: any) => m.id);
    this.logger.info('forward', `${targetGroups.length} ta guruhga yuborilmoqda... (Toifa: ${analyzeResult})`);

    let sentCount = 0;
    for (const target of targetGroups) {
      const destId = target.group_id;
      try {
        let destination: any = destId;
        if (/^-?\d+$/.test(destId.trim())) {
          try {
            destination = await this.client.getInputEntity(destId.trim());
          } catch {
            destination = destId.trim();
          }
        }

        if (info) {
          try {
            await this.client.sendMessage(destination, { message: info });
          } catch (e: any) {
            this.logger.warn('forward', `Info xabarini yuborishda xatolik: ${e?.message || e}`);
          }
        }

        try {
          await this.client.forwardMessages(destination, {
            messages: msgIds,
            fromPeer: sourceChat,
          });
          sentCount++;
          this.logger.success('forward', `Xabar guruhga uzatildi (forward): ${destId}`);
        } catch (fwdErr: any) {
          this.logger.warn(
            'forward',
            `Forward qilish o'xshamadi (${fwdErr?.message || fwdErr}), matn shaklida yuborilmoqda...`,
          );
          const rawId = sourceChat.toString();
          const cleanId = rawId.startsWith('-100') ? rawId.slice(4) : rawId.replace(/^-/, '');
          const msgId = msgIds[0];
          const postLink = `https://t.me/c/${cleanId}/${msgId}`;
          const newText = `${text}\n\n🔗 Manba: ${postLink}`;
          await this.client.sendMessage(destination, {
            message: newText,
            linkPreview: false,
          });
          sentCount++;
          this.logger.success('forward', `Xabar matn shaklida guruhga yuborildi: ${destId}`);
        }
      } catch (err: any) {
        this.logger.error('forward', `Guruhga (${destId}) yuborishda xatolik: ${err?.message || err}`);
      }
    }

    const finalStatus = sentCount > 0 ? 'SENT' : 'FAILED';
    await this.db.markAsSent(uniqueId, text.slice(0, 500), analyzeResult, channelName, finalStatus);
    if (finalStatus === 'SENT') {
      this.logger.success('system', `Xabar to'liq qayta ishlandi va tarixga yozildi (${analyzeResult} -> SENT)`);
    } else {
      this.logger.error('system', `Xabarni guruhlarga yuborib bo'lmadi (${analyzeResult} -> FAILED)`);
    }
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
      } catch { }
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
      const channelDetails = dbChannels.map((ch: string) => ({
        ident: ch,
        isJoined: false,
      }));
      const groupDetails = dbGroups.map((gr: any) => ({
        group_id: gr.group_id,
        type: gr.type,
        isJoined: false,
      }));

      return {
        connected: false,
        totalChannels: dbChannels.length,
        joinedChannels: 0,
        missingChannels: dbChannels,
        channelDetails,
        totalGroups: dbGroups.length,
        joinedGroups: 0,
        missingGroups: dbGroups,
        groupDetails,
      };
    }

    try {
      this.logger.info('telegram', 'Dialoglar ro\'yxati yuklanmoqda (a\'zolikni tekshirish)...');
      const dialogs = await this.client.getDialogs({ limit: 1000 });
      const joinedUsernamesOrIds = new Set<string>();

      for (const d of dialogs) {
        if (d.id !== undefined && d.id !== null) {
          const variants = this.getNormalizedIdVariants(d.id);
          variants.forEach((v) => joinedUsernamesOrIds.add(v));
        }
        if (d.entity) {
          if (d.entity.id !== undefined && d.entity.id !== null) {
            const variants = this.getNormalizedIdVariants(d.entity.id);
            variants.forEach((v) => joinedUsernamesOrIds.add(v));
          }
          if (d.entity.username) {
            const u = d.entity.username.toLowerCase().trim();
            joinedUsernamesOrIds.add(u);
            joinedUsernamesOrIds.add(`@${u}`);
          }
        }
      }

      const channelDetails = dbChannels.map((ch: string) => {
        const clean = ch.replace('https://t.me/', '').replace('@', '').toLowerCase().trim();
        const idVariants = this.getNormalizedIdVariants(clean);
        const isJoined =
          joinedUsernamesOrIds.has(clean) ||
          joinedUsernamesOrIds.has(`@${clean}`) ||
          idVariants.some((v) => joinedUsernamesOrIds.has(v));
        return {
          ident: ch,
          isJoined,
        };
      });

      const missingChannels = channelDetails.filter((c) => !c.isJoined).map((c) => c.ident);

      const groupDetails = dbGroups.map((gr: any) => {
        const clean = gr.group_id.toString().trim();
        const idVariants = this.getNormalizedIdVariants(clean);
        const isJoined =
          joinedUsernamesOrIds.has(clean.toLowerCase()) ||
          idVariants.some((v) => joinedUsernamesOrIds.has(v));
        return {
          group_id: gr.group_id,
          type: gr.type,
          isJoined,
        };
      });

      const missingGroups = groupDetails.filter((g) => !g.isJoined);

      this.logger.info(
        'telegram',
        `A'zolik tekshirildi: Kanallar ${channelDetails.length - missingChannels.length}/${channelDetails.length}, Guruhlar ${groupDetails.length - missingGroups.length}/${groupDetails.length}`,
      );

      return {
        connected: true,
        totalChannels: dbChannels.length,
        joinedChannels: channelDetails.length - missingChannels.length,
        missingChannels,
        channelDetails,
        totalGroups: dbGroups.length,
        joinedGroups: groupDetails.length - missingGroups.length,
        missingGroups,
        groupDetails,
      };
    } catch (err: any) {
      this.logger.error('telegram', `Dialoglarni tekshirishda xatolik: ${err?.message || err}`);
      const channelDetails = dbChannels.map((ch: string) => ({
        ident: ch,
        isJoined: false,
      }));
      const groupDetails = dbGroups.map((gr: any) => ({
        group_id: gr.group_id,
        type: gr.type,
        isJoined: false,
      }));

      return {
        connected: this.isConnected,
        error: err?.message || 'Dialoglarni yuklashda xatolik',
        totalChannels: dbChannels.length,
        joinedChannels: 0,
        missingChannels: dbChannels,
        channelDetails,
        totalGroups: dbGroups.length,
        joinedGroups: 0,
        missingGroups: dbGroups,
        groupDetails,
      };
    }
  }

  async getChannelsWithStatus(): Promise<any[]> {
    const sync = await this.checkChannelsSync();
    return sync.channelDetails || [];
  }

  async getGroupsWithStatus(type?: string): Promise<any[]> {
    const sync = await this.checkChannelsSync();
    let groups = sync.groupDetails || [];
    if (type) {
      groups = groups.filter((g: any) => g.type === type.toLowerCase());
    }
    return groups;
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

