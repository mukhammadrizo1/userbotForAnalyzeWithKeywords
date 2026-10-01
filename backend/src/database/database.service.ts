import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool: any;

  async onModuleInit() {
    const connectionString = process.env.DATABASE_URL;
    this.pool = new Pool({
      connectionString,
      ssl: connectionString && connectionString.includes('sslmode=') ? { rejectUnauthorized: false } : undefined,
    });
    await this.initSchema();
  }

  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.end();
    }
  }

  private async initSchema() {
    await this.query(`
      CREATE TABLE IF NOT EXISTS channels (
        ident TEXT PRIMARY KEY
      );
      ALTER TABLE channels ADD COLUMN IF NOT EXISTS channel_id TEXT;
      ALTER TABLE channels ADD COLUMN IF NOT EXISTS username TEXT;
      ALTER TABLE channels ADD COLUMN IF NOT EXISTS title TEXT;
      ALTER TABLE channels ADD COLUMN IF NOT EXISTS last_msg_id BIGINT;
      ALTER TABLE channels ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMP;

      CREATE TABLE IF NOT EXISTS keywords (
        word TEXT PRIMARY KEY
      );
      CREATE TABLE IF NOT EXISTS groups (
        group_id TEXT,
        type TEXT,
        PRIMARY KEY(group_id, type)
      );
      CREATE TABLE IF NOT EXISTS history (
        msg_unique_id TEXT PRIMARY KEY,
        date_added TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        text TEXT,
        sentiment TEXT,
        channel TEXT,
        status TEXT
      );
      ALTER TABLE history ADD COLUMN IF NOT EXISTS error_message TEXT;
      ALTER TABLE history ADD COLUMN IF NOT EXISTS post_link TEXT;
      ALTER TABLE history ADD COLUMN IF NOT EXISTS raw_chat_id TEXT;
      ALTER TABLE history ADD COLUMN IF NOT EXISTS raw_msg_id BIGINT;

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);
  }

  async getSetting(key: string): Promise<string | null> {
    const res = await this.query('SELECT value FROM settings WHERE key = $1', [key]);
    return res.rows.length > 0 ? res.rows[0].value : null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await this.query(
      'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
      [key, value],
    );
  }

  async deleteSetting(key: string): Promise<void> {
    await this.query('DELETE FROM settings WHERE key = $1', [key]);
  }

  async query(text: string, params?: any[]): Promise<any> {
    return this.pool.query(text, params);
  }

  cleanChannelInput(input: string): string {
    if (!input) return '';
    let clean = input.trim();
    const cLinkMatch = clean.match(/t\.me\/c\/(\d+)/i);
    if (cLinkMatch) {
      return cLinkMatch[1];
    }
    clean = clean.replace(/^https?:\/\/t\.me\//i, '');
    clean = clean.replace(/^@/, '');
    clean = clean.split('/')[0].split('?')[0].trim();
    return clean;
  }

  async getChannels(): Promise<any[]> {
    const res = await this.query('SELECT ident FROM channels ORDER BY ident ASC');
    return res.rows.map((r: any) => r.ident);
  }

  async getChannelsDetailed(): Promise<any[]> {
    const res = await this.query(
      'SELECT ident, channel_id, username, title, last_msg_id, last_checked_at FROM channels ORDER BY ident ASC',
    );
    return res.rows;
  }

  async updateChannelProgress(ident: string, lastMsgId: number): Promise<void> {
    const clean = this.cleanChannelInput(ident);
    await this.query(
      'UPDATE channels SET last_msg_id = $1, last_checked_at = CURRENT_TIMESTAMP WHERE ident = $2',
      [lastMsgId, clean],
    );
  }

  async updateChannelDetails(ident: string, details: { channelId?: string; username?: string; title?: string }): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (details.channelId !== undefined) {
      fields.push(`channel_id = $${idx++}`);
      values.push(details.channelId);
    }
    if (details.username !== undefined) {
      fields.push(`username = $${idx++}`);
      values.push(details.username);
    }
    if (details.title !== undefined) {
      fields.push(`title = $${idx++}`);
      values.push(details.title);
    }

    if (fields.length === 0) return;
    values.push(ident);
    await this.query(`UPDATE channels SET ${fields.join(', ')} WHERE ident = $${idx}`, values);
  }

  async addChannel(ident: string): Promise<boolean> {
    const clean = this.cleanChannelInput(ident);
    if (!clean) return false;
    const res = await this.query(
      'INSERT INTO channels (ident) VALUES ($1) ON CONFLICT (ident) DO NOTHING',
      [clean],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async addChannelsBatch(idents: string[]): Promise<{ added: number; total: number }> {
    let added = 0;
    for (const item of idents) {
      const clean = this.cleanChannelInput(item);
      if (clean) {
        const ok = await this.addChannel(clean);
        if (ok) added++;
      }
    }
    return { added, total: idents.length };
  }

  async updateChannel(oldIdent: string, newIdent: string): Promise<boolean> {
    const cleanOld = this.cleanChannelInput(oldIdent);
    const cleanNew = this.cleanChannelInput(newIdent);
    if (!cleanNew) return false;
    const res = await this.query('UPDATE channels SET ident = $1 WHERE ident = $2', [cleanNew, cleanOld]);
    return (res.rowCount ?? 0) > 0;
  }

  async deleteChannel(ident: string): Promise<boolean> {
    const clean = this.cleanChannelInput(ident);
    const res = await this.query('DELETE FROM channels WHERE ident = $1', [clean]);
    return (res.rowCount ?? 0) > 0;
  }

  async getKeywords(): Promise<any[]> {
    const res = await this.query('SELECT word FROM keywords ORDER BY word ASC');
    return res.rows.map((r: any) => r.word);
  }

  async addKeyword(word: string): Promise<boolean> {
    const clean = word.toLowerCase().trim();
    if (clean.length < 2) return false;
    const res = await this.query(
      'INSERT INTO keywords (word) VALUES ($1) ON CONFLICT (word) DO NOTHING',
      [clean],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async addKeywordsBatch(words: string[]): Promise<{ added: number; total: number }> {
    let added = 0;
    for (const w of words) {
      const ok = await this.addKeyword(w);
      if (ok) added++;
    }
    return { added, total: words.length };
  }

  async updateKeyword(oldWord: string, newWord: string): Promise<boolean> {
    const cleanOld = oldWord.toLowerCase().trim();
    const cleanNew = newWord.toLowerCase().trim();
    if (cleanNew.length < 2) return false;
    const res = await this.query('UPDATE keywords SET word = $1 WHERE word = $2', [cleanNew, cleanOld]);
    return (res.rowCount ?? 0) > 0;
  }

  async deleteKeyword(word: string): Promise<boolean> {
    const clean = word.toLowerCase().trim();
    const res = await this.query('DELETE FROM keywords WHERE word = $1', [clean]);
    return (res.rowCount ?? 0) > 0;
  }

  async getGroups(type?: string): Promise<any[]> {
    if (type) {
      const res = await this.query('SELECT group_id, type FROM groups WHERE type = $1 ORDER BY group_id ASC', [type]);
      return res.rows;
    }
    const res = await this.query('SELECT group_id, type FROM groups ORDER BY type, group_id ASC');
    return res.rows;
  }

  async addGroup(groupId: string, type: string): Promise<boolean> {
    const cleanId = groupId.trim();
    const cleanType = type.toLowerCase().trim();
    if (!['good', 'bad', 'neutral'].includes(cleanType)) return false;
    const res = await this.query(
      'INSERT INTO groups (group_id, type) VALUES ($1, $2) ON CONFLICT (group_id, type) DO NOTHING',
      [cleanId, cleanType],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async updateGroup(oldGroupId: string, oldType: string, newGroupId: string, newType: string): Promise<boolean> {
    const cleanOldId = oldGroupId.trim();
    const cleanOldType = oldType.toLowerCase().trim();
    const cleanNewId = newGroupId.trim();
    const cleanNewType = newType.toLowerCase().trim();
    if (!['good', 'bad', 'neutral'].includes(cleanNewType)) return false;
    const res = await this.query(
      'UPDATE groups SET group_id = $1, type = $2 WHERE group_id = $3 AND type = $4',
      [cleanNewId, cleanNewType, cleanOldId, cleanOldType],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async deleteGroup(groupId: string, type: string): Promise<boolean> {
    const cleanId = groupId.trim();
    const cleanType = type.toLowerCase().trim();
    const res = await this.query(
      'DELETE FROM groups WHERE group_id = $1 AND type = $2',
      [cleanId, cleanType],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async isAlreadySent(uniqueId: string): Promise<boolean> {
    const res = await this.query('SELECT 1 FROM history WHERE msg_unique_id = $1', [uniqueId]);
    return res.rowCount > 0;
  }

  async markAsSent(
    uniqueId: string,
    text?: string,
    sentiment?: string,
    channel?: string,
    status?: string,
    errorMessage?: string,
    postLink?: string,
    rawChatId?: string,
    rawMsgId?: number,
  ): Promise<void> {
    try {
      await this.query(
        `INSERT INTO history (msg_unique_id, text, sentiment, channel, status, error_message, post_link, raw_chat_id, raw_msg_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (msg_unique_id) DO UPDATE SET
           text = COALESCE(EXCLUDED.text, history.text),
           sentiment = COALESCE(EXCLUDED.sentiment, history.sentiment),
           channel = COALESCE(EXCLUDED.channel, history.channel),
           status = COALESCE(EXCLUDED.status, history.status),
           error_message = COALESCE(EXCLUDED.error_message, history.error_message),
           post_link = COALESCE(EXCLUDED.post_link, history.post_link),
           raw_chat_id = COALESCE(EXCLUDED.raw_chat_id, history.raw_chat_id),
           raw_msg_id = COALESCE(EXCLUDED.raw_msg_id, history.raw_msg_id),
           date_added = CURRENT_TIMESTAMP`,
        [
          uniqueId,
          text || null,
          sentiment || null,
          channel || null,
          status || null,
          errorMessage || null,
          postLink || null,
          rawChatId || null,
          rawMsgId || null,
        ],
      );
      await this.query(
        'DELETE FROM history WHERE msg_unique_id NOT IN (SELECT msg_unique_id FROM history ORDER BY date_added DESC LIMIT 1000)',
      );
    } catch (err: any) {
      console.error('Bazada history saqlashda xatolik:', err?.message || err);
    }
  }

  async getRecentHistory(limit: number = 50, filterType?: string): Promise<any[]> {
    let sql =
      'SELECT msg_unique_id, date_added, text, sentiment, channel, status, error_message, post_link, raw_chat_id, raw_msg_id FROM history';
    const params: any[] = [];

    if (filterType && filterType !== 'all') {
      params.push(filterType.toUpperCase());
      sql += ' WHERE sentiment = $1 OR status = $1';
    }

    params.push(limit);
    sql += ` ORDER BY date_added DESC LIMIT $${params.length}`;

    const res = await this.query(sql, params);
    return res.rows;
  }

  async getHistoryItem(uniqueId: string): Promise<any | null> {
    const res = await this.query(
      'SELECT msg_unique_id, date_added, text, sentiment, channel, status, error_message, post_link, raw_chat_id, raw_msg_id FROM history WHERE msg_unique_id = $1',
      [uniqueId],
    );
    return res.rows.length > 0 ? res.rows[0] : null;
  }

  async getHistoryItemsMap(uniqueIds: string[]): Promise<Map<string, any>> {
    const map = new Map<string, any>();
    if (!uniqueIds || uniqueIds.length === 0) return map;
    try {
      const res = await this.query(
        'SELECT msg_unique_id, date_added, text, sentiment, channel, status, error_message, post_link, raw_chat_id, raw_msg_id FROM history WHERE msg_unique_id = ANY($1)',
        [uniqueIds],
      );
      for (const row of res.rows) {
        map.set(row.msg_unique_id, row);
      }
    } catch (err: any) {
      console.error('getHistoryItemsMap xatosi:', err?.message || err);
    }
    return map;
  }

  async deleteHistoryItem(uniqueId: string): Promise<boolean> {
    const res = await this.query('DELETE FROM history WHERE msg_unique_id = $1', [uniqueId]);
    return (res.rowCount ?? 0) > 0;
  }

  async clearHistory(): Promise<boolean> {
    const res = await this.query('DELETE FROM history');
    return (res.rowCount ?? 0) >= 0;
  }

  async getCounts(): Promise<any> {
    const [ch, kw, gr, hi] = await Promise.all([
      this.query('SELECT COUNT(*) FROM channels'),
      this.query('SELECT COUNT(*) FROM keywords'),
      this.query('SELECT COUNT(*) FROM groups'),
      this.query('SELECT COUNT(*) FROM history'),
    ]);
    return {
      channels: parseInt(ch.rows[0].count, 10),
      keywords: parseInt(kw.rows[0].count, 10),
      groups: parseInt(gr.rows[0].count, 10),
      history: parseInt(hi.rows[0].count, 10),
    };
  }
}
