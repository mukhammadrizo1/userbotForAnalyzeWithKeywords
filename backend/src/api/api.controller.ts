import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { UserbotService } from '../userbot/userbot.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('api')
export class ApiController {
  constructor(
    private readonly db: DatabaseService,
    private readonly userbot: UserbotService,
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
    return { channels };
  }

  @UseGuards(AuthGuard)
  @Post('channels')
  async addChannel(@Body() body: any): Promise<any> {
    const ok = await this.db.addChannel(body.ident);
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
  @Delete('keywords/:word')
  async deleteKeyword(@Param('word') word: string): Promise<any> {
    const ok = await this.db.deleteKeyword(word);
    return { success: ok };
  }

  @UseGuards(AuthGuard)
  @Get('groups')
  async getGroups(@Query('type') type?: string): Promise<any> {
    const groups = await this.db.getGroups(type);
    return { groups };
  }

  @UseGuards(AuthGuard)
  @Post('groups')
  async addGroup(@Body() body: any): Promise<any> {
    const ok = await this.db.addGroup(body.group_id, body.type);
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
}
