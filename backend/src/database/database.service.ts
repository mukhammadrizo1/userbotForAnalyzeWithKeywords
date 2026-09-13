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
    `);
  }

  async query(text: string, params?: any[]): Promise<any> {
    return this.pool.query(text, params);
  }

  async getChannels(): Promise<any[]> {
    const res = await this.query('SELECT ident FROM channels ORDER BY ident ASC');
    return res.rows.map((r: any) => r.ident);
  }

  async addChannel(ident: string): Promise<boolean> {
    const clean = ident.replace('https://t.me/', '').replace('@', '').trim();
    if (!clean) return false;
    const res = await this.query(
      'INSERT INTO channels (ident) VALUES ($1) ON CONFLICT (ident) DO NOTHING',
      [clean],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async updateChannel(oldIdent: string, newIdent: string): Promise<boolean> {
    const cleanOld = oldIdent.replace('https://t.me/', '').replace('@', '').trim();
    const cleanNew = newIdent.replace('https://t.me/', '').replace('@', '').trim();
    if (!cleanNew) return false;
    const res = await this.query('UPDATE channels SET ident = $1 WHERE ident = $2', [cleanNew, cleanOld]);
    return (res.rowCount ?? 0) > 0;
  }

  async deleteChannel(ident: string): Promise<boolean> {
    const clean = ident.replace('https://t.me/', '').replace('@', '').trim();
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

  async markAsSent(uniqueId: string, text?: string, sentiment?: string, channel?: string, status?: string): Promise<void> {
    try {
      await this.query(
        'INSERT INTO history (msg_unique_id, text, sentiment, channel, status) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (msg_unique_id) DO NOTHING',
        [uniqueId, text || null, sentiment || null, channel || null, status || null],
      );
      await this.query(
        'DELETE FROM history WHERE msg_unique_id NOT IN (SELECT msg_unique_id FROM history ORDER BY date_added DESC LIMIT 1000)',
      );
    } catch {}
  }

  async getRecentHistory(limit: number = 50): Promise<any[]> {
    const res = await this.query(
      'SELECT msg_unique_id, date_added, text, sentiment, channel, status FROM history ORDER BY date_added DESC LIMIT $1',
      [limit],
    );
    return res.rows;
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
