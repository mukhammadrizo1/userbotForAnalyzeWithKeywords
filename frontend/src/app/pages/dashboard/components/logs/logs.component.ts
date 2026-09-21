import {
  Component,
  OnInit,
  OnDestroy,
  signal,
  computed,
  ViewChild,
  ElementRef,
  AfterViewChecked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../core/api.service';

export interface LogItem {
  id: number;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  category: 'telegram' | 'groq' | 'forward' | 'system';
  message: string;
  details?: any;
}

@Component({
  selector: 'app-logs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './logs.component.html',
  styleUrl: './logs.component.css',
})
export class LogsComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('logContainer') private logContainer!: ElementRef;

  logs = signal<LogItem[]>([]);
  searchQuery = signal<string>('');
  selectedLevel = signal<string>('all');
  selectedCategory = signal<string>('all');
  autoScroll = signal<boolean>(true);
  isConnected = signal<boolean>(false);
  isLoading = signal<boolean>(false);

  private eventSource: EventSource | null = null;
  private pollInterval: any = null;
  private shouldScrollToBottom = false;

  readonly filteredLogs = computed(() => {
    const list = this.logs();
    const query = this.searchQuery().toLowerCase().trim();
    const level = this.selectedLevel();
    const cat = this.selectedCategory();

    return list.filter((log) => {
      if (level !== 'all' && log.level !== level) return false;
      if (cat !== 'all' && log.category !== cat) return false;
      if (query) {
        const text = `${log.message} ${log.category} ${log.level} ${JSON.stringify(log.details || '')}`.toLowerCase();
        if (!text.includes(query)) return false;
      }
      return true;
    });
  });

  readonly errorCount = computed(() => this.logs().filter((l) => l.level === 'error').length);
  readonly warnCount = computed(() => this.logs().filter((l) => l.level === 'warn').length);

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.fetchInitialLogs();
    this.startStreaming();
  }

  ngOnDestroy(): void {
    this.stopStreaming();
  }

  ngAfterViewChecked(): void {
    if (this.autoScroll() && this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  fetchInitialLogs(): void {
    this.isLoading.set(true);
    this.api.getLogs(250).subscribe({
      next: (res) => {
        this.logs.set(res.logs || []);
        this.isLoading.set(false);
        this.shouldScrollToBottom = true;
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  startStreaming(): void {
    if (typeof window === 'undefined') return;

    try {
      const url = this.api.getLogsStreamUrl();
      this.eventSource = new EventSource(url);

      this.eventSource.onopen = () => {
        this.isConnected.set(true);
      };

      this.eventSource.onmessage = (event) => {
        try {
          const item: LogItem = JSON.parse(event.data);
          this.logs.update((prev) => {
            const next = [...prev, item];
            if (next.length > 500) next.shift();
            return next;
          });
          this.shouldScrollToBottom = true;
        } catch {}
      };

      this.eventSource.onerror = () => {
        this.isConnected.set(false);
        this.startPollingFallback();
      };
    } catch {
      this.startPollingFallback();
    }
  }

  startPollingFallback(): void {
    if (this.pollInterval) return;
    this.pollInterval = setInterval(() => {
      const currentLogs = this.logs();
      const lastId = currentLogs.length > 0 ? currentLogs[currentLogs.length - 1].id : undefined;
      this.api.getLogs(50, lastId).subscribe({
        next: (res) => {
          const newItems: LogItem[] = res.logs || [];
          if (newItems.length > 0) {
            this.logs.update((prev) => {
              const existingIds = new Set(prev.map((l) => l.id));
              const toAdd = newItems.filter((l) => !existingIds.has(l.id));
              if (toAdd.length === 0) return prev;
              const combined = [...prev, ...toAdd];
              if (combined.length > 500) combined.splice(0, combined.length - 500);
              return combined;
            });
            this.shouldScrollToBottom = true;
          }
          this.isConnected.set(true);
        },
        error: () => {
          this.isConnected.set(false);
        },
      });
    }, 2500);
  }

  stopStreaming(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  clearLogs(): void {
    this.api.clearLogs().subscribe({
      next: () => {
        this.logs.set([]);
      },
    });
  }

  toggleAutoScroll(): void {
    this.autoScroll.update((v) => !v);
    if (this.autoScroll()) {
      this.scrollToBottom();
    }
  }

  private scrollToBottom(): void {
    try {
      if (this.logContainer) {
        this.logContainer.nativeElement.scrollTop = this.logContainer.nativeElement.scrollHeight;
      }
    } catch {}
  }

  formatTime(iso: string): string {
    if (!iso) return '';
    const parts = iso.split('T');
    if (parts.length > 1) {
      return parts[1].slice(0, 8);
    }
    return iso;
  }
}
