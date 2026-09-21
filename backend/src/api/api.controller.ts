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
    const channels = await this.db.getChannels();
    let channelDetails: any[] = [];
    try {
      channelDetails = await this.userbot.getChannelsWithStatus();
    } catch {
      channelDetails = channels.map((c: string) => ({ ident: c, isJoined: false }));
    }
    return { channels, channelDetails };
  }

  @UseGuards(AuthGuard)
  @Post('channels')
  async addChannel(@Body() body: any): Promise<any> {
    const ok = await this.db.addChannel(body.ident);
    return { success: ok };
  }

  @UseGuards(AuthGuard)
  @Put('channels/:id')
  async updateChannel(@Param('id') id: string, @Body() body: any): Promise<any> {
    const ok = await this.db.updateChannel(id, body.newIdent);
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
  async getHistory(@Query('limit') limit?: string): Promise<any> {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    const history = await this.db.getRecentHistory(isNaN(parsedLimit) ? 50 : parsedLimit);
    return { history };
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
