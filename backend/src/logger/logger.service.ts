import { Injectable } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';

export interface LogEntry {
  id: number;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  category: 'telegram' | 'groq' | 'forward' | 'system';
  message: string;
  details?: any;
}

@Injectable()
export class LoggerService {
  private logs: LogEntry[] = [];
  private maxLogs = 400;
  private idCounter = 1;
  private logSubject = new Subject<LogEntry>();

  constructor() {
    this.info('system', 'Jonli loglar xizmati ishga tushdi');
  }

  log(
    level: 'info' | 'warn' | 'error' | 'success',
    category: 'telegram' | 'groq' | 'forward' | 'system',
    message: string,
    details?: any,
  ): LogEntry {
    const entry: LogEntry = {
      id: this.idCounter++,
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      details,
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    this.logSubject.next(entry);

    const timeStr = entry.timestamp.split('T')[1].slice(0, 8);
    const prefix = `[${timeStr}] [${category.toUpperCase()}] [${level.toUpperCase()}]`;
    if (level === 'error') {
      console.error(prefix, message, details ? details : '');
    } else if (level === 'warn') {
      console.warn(prefix, message, details ? details : '');
    } else {
      console.log(prefix, message, details ? details : '');
    }

    return entry;
  }

  info(category: 'telegram' | 'groq' | 'forward' | 'system', message: string, details?: any) {
    return this.log('info', category, message, details);
  }

  success(category: 'telegram' | 'groq' | 'forward' | 'system', message: string, details?: any) {
    return this.log('success', category, message, details);
  }

  warn(category: 'telegram' | 'groq' | 'forward' | 'system', message: string, details?: any) {
    return this.log('warn', category, message, details);
  }

  error(category: 'telegram' | 'groq' | 'forward' | 'system', message: string, details?: any) {
    return this.log('error', category, message, details);
  }

  getLogs(limit = 100, sinceId?: number): LogEntry[] {
    let result = this.logs;
    if (sinceId && !isNaN(sinceId)) {
      result = result.filter((l) => l.id > sinceId);
    }
    return result.slice(-Math.min(limit, this.maxLogs));
  }

  clearLogs(): void {
    this.logs = [];
    this.info('system', 'Barcha loglar tozalandi');
  }

  getStream(): Observable<LogEntry> {
    return this.logSubject.asObservable();
  }
}
