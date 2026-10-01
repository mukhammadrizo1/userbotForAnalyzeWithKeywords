import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Sse, MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { DatabaseService } from '../database/database.service';
import { UserbotService } from '../userbot/userbot.service';
import { LoggerService } from '../logger/logger.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('api')
export class ApiController {
  constructor(
    private readonly db: DatabaseService,
    private readonly userbot: UserbotService,
    private readonly logger: LoggerService,
  ) {}

  @Get('ping')
  ping(): any {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  @UseGuards(AuthGuard)
  @Get('status')
  async getStatus(): Promise<any> {
    return this.userbot.getStatus();
  }

  @UseGuards(AuthGuard)
  @Get('channels')
  async getChannels(): Promise<any> {
    const detailed = await this.db.getChannelsDetailed();
    const channels = detailed.map((c: any) => c.ident);
    const channelDetails = detailed.map((c: any) => ({
      ident: c.ident,
      channelId: c.channel_id,
      username: c.username,
      title: c.title,
      lastMsgId: c.last_msg_id,
      lastCheckedAt: c.last_checked_at,
      isJoined: true, // Bazadagi kanallar faol monitoring ostida
    }));
    return { channels, channelDetails };
  }

  @UseGuards(AuthGuard)
  @Post('channels')
  async addChannel(@Body() body: any): Promise<any> {
    const ok = await this.db.addChannel(body.ident);
    if (ok && body.ident) {
      this.userbot.resolveAndCacheChannel(body.ident).catch(() => {});
    }
    return { success: ok };
  }

  @UseGuards(AuthGuard)
  @Post('channels/batch')
  async addChannelsBatch(@Body() body: { idents: string[] }): Promise<any> {
    const res = await this.db.addChannelsBatch(body.idents || []);
    this.userbot.refreshDialogsAndChannelsCache().catch(() => {});
    return { success: true, ...res };
  }

  @UseGuards(AuthGuard)
  @Put('channels/:id')
  async updateChannel(@Param('id') id: string, @Body() body: any): Promise<any> {
    const ok = await this.db.updateChannel(id, body.newIdent);
    if (ok && body.newIdent) {
      this.userbot.resolveAndCacheChannel(body.newIdent).catch(() => {});
    }
    return { success: ok };
  }

  @UseGuards(AuthGuard)
  @Delete('channels/:id')
  async deleteChannel(@Param('id') id: string): Promise<any> {
    const ok = await this.db.deleteChannel(id);
    return { success: ok };
  }

  @UseGuards(AuthGuard)
  @Get('keywords')
  async getKeywords(): Promise<any> {
    const keywords = await this.db.getKeywords();
    return { keywords };
  }

  @UseGuards(AuthGuard)
  @Post('keywords')
  async addKeyword(@Body() body: any): Promise<any> {
    const ok = await this.db.addKeyword(body.word);
    return { success: ok };
  }

  @UseGuards(AuthGuard)
  @Post('keywords/batch')
  async addKeywordsBatch(@Body() body: { words: string[] }): Promise<any> {
    const res = await this.db.addKeywordsBatch(body.words || []);
    this.userbot.refreshDialogsAndChannelsCache().catch(() => {});
    return { success: true, ...res };
  }

  @UseGuards(AuthGuard)
  @Put('keywords/:word')
  async updateKeyword(@Param('word') word: string, @Body() body: any): Promise<any> {
    const ok = await this.db.updateKeyword(word, body.newWord);
    return { success: ok };
  }

  @UseGuards(AuthGuard)
  @Delete('keywords/:word')
  async deleteKeyword(@Param('word') word: string): Promise<any> {
    const ok = await this.db.deleteKeyword(word);
    return { success: ok };
  }

  @UseGuards(AuthGuard)
  @Get('groups')
  async getGroups(@Query('type') type?: string): Promise<any> {
    const rawGroups = await this.db.getGroups(type);
    let groups: any[] = rawGroups;
    try {
      groups = await this.userbot.getGroupsWithStatus(type);
    } catch {
      groups = rawGroups.map((g: any) => ({ ...g, isJoined: false }));
    }
    return { groups };
  }

  @UseGuards(AuthGuard)
  @Post('groups')
  async addGroup(@Body() body: any): Promise<any> {
    const ok = await this.db.addGroup(body.group_id, body.type);
    return { success: ok };
  }

  @UseGuards(AuthGuard)
  @Put('groups/:type/:id')
  async updateGroup(
    @Param('type') type: string,
    @Param('id') id: string,
    @Body() body: any,
  ): Promise<any> {
    const ok = await this.db.updateGroup(id, type, body.newGroupId, body.newType);
    return { success: ok };
  }

  @UseGuards(AuthGuard)
  @Delete('groups/:type/:id')
  async deleteGroup(@Param('type') type: string, @Param('id') id: string): Promise<any> {
    const ok = await this.db.deleteGroup(id, type);
    return { success: ok };
  }

  @UseGuards(AuthGuard)
  @Get('history')
  async getHistory(@Query('limit') limit?: string, @Query('type') type?: string): Promise<any> {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    const history = await this.db.getRecentHistory(isNaN(parsedLimit) ? 50 : parsedLimit, type);
    return { history };
  }

  @UseGuards(AuthGuard)
  @Post('history/:id/resend')
  async resendHistoryItem(@Param('id') id: string, @Body() body: any): Promise<any> {
    return this.userbot.resendHistoryItem(id, body?.overrideType);
  }

  @UseGuards(AuthGuard)
  @Delete('history/:id')
  async deleteHistoryItem(@Param('id') id: string): Promise<any> {
    const ok = await this.db.deleteHistoryItem(id);
    return { success: ok };
  }

  @UseGuards(AuthGuard)
  @Delete('history')
  async clearHistory(): Promise<any> {
    const ok = await this.db.clearHistory();
    return { success: ok };
  }

  @UseGuards(AuthGuard)
  @Post('tester/analyze')
  async testAi(@Body() body: { text: string }): Promise<any> {
    return this.userbot.testAiContent(body?.text || '');
  }

  @UseGuards(AuthGuard)
  @Post('inspector/scan')
  async scanHistoricalRange(@Body() body: any): Promise<any> {
    return this.userbot.scanHistoricalRange(body);
  }

  @UseGuards(AuthGuard)
  @Post('inspector/forward')
  async forwardInspectedPosts(@Body() body: any): Promise<any> {
    return this.userbot.forwardInspectedPosts(body);
  }

  @UseGuards(AuthGuard)
  @Get('system/mode')
  async getSystemMode(): Promise<any> {
    return this.userbot.getSystemMode();
  }

  @UseGuards(AuthGuard)
  @Post('system/mode')
  async setSystemMode(@Body() body: { isPaused?: boolean; isSimulationMode?: boolean }): Promise<any> {
    return this.userbot.setSystemMode(body);
  }

  @UseGuards(AuthGuard)
  @Post('telegram/send-code')
  async sendTelegramCode(@Body() body: any): Promise<any> {
    return this.userbot.sendAuthCode(body.phone);
  }

  @UseGuards(AuthGuard)
  @Post('telegram/verify-code')
  async verifyTelegramCode(@Body() body: any): Promise<any> {
    return this.userbot.verifyAuthCode(body.phone, body.code, body.phoneCodeHash, body.password);
  }

  @UseGuards(AuthGuard)
  @Post('telegram/disconnect')
  async disconnectTelegram(): Promise<any> {
    return this.userbot.disconnectBot();
  }

  @UseGuards(AuthGuard)
  @Post('telegram/reconnect')
  async reconnectTelegram(): Promise<any> {
    return this.userbot.reconnectBot();
  }

  @UseGuards(AuthGuard)
  @Get('telegram/sync-status')
  async getTelegramSyncStatus(): Promise<any> {
    return this.userbot.checkChannelsSync();
  }

  @UseGuards(AuthGuard)
  @Post('telegram/auto-join')
  async autoJoinTelegramChannels(): Promise<any> {
    return this.userbot.autoJoinChannels();
  }

  @UseGuards(AuthGuard)
  @Get('logs')
  getLogs(@Query('limit') limit?: string, @Query('sinceId') sinceId?: string): any {
    const parsedLimit = limit ? parseInt(limit, 10) : 100;
    const parsedSinceId = sinceId ? parseInt(sinceId, 10) : undefined;
    return {
      logs: this.logger.getLogs(parsedLimit, parsedSinceId),
    };
  }

  @UseGuards(AuthGuard)
  @Delete('logs')
  clearLogs(): any {
    this.logger.clearLogs();
    return { success: true };
  }

  @UseGuards(AuthGuard)
  @Sse('logs/stream')
  streamLogs(): Observable<MessageEvent> {
    return this.logger.getStream().pipe(
      map((entry) => ({ data: entry } as MessageEvent)),
    );
  }
}
