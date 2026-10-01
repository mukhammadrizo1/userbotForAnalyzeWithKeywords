import { Component, Input, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../core/api.service';

export interface InspectedPost {
  uniqueId: string;
  channel: string;
  channelTitle: string;
  channelUsername?: string;
  rawChatId: string;
  rawMsgId: number;
  date: string;
  text: string;
  matchedKeywords: string[];
  postLink: string;
  isAlreadySent: boolean;
  existingStatus?: string;
  existingSentiment?: string;
  mediaType?: string;
}

@Component({
  selector: 'app-inspector',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
  ],
  templateUrl: './inspector.component.html',
  styleUrl: './inspector.component.css',
})
export class InspectorComponent implements OnInit {
  @Input() set channels(val: any[]) {
    this._dbChannels.set(val || []);
  }
  @Input() set keywords(val: string[]) {
    this._dbKeywords.set(val || []);
  }

  _dbChannels = signal<any[]>([]);
  _dbKeywords = signal<string[]>([]);

  // Skaner konfiguratsiyasi
  channelScope = signal<'all' | 'selected' | 'custom'>('all');
  customChannelInput = signal<string>('');
  selectedChannelIdents = signal<string[]>([]);

  presetRange = signal<'3h' | 'today' | '24h' | '3d' | 'custom'>('24h');
  startDate = signal<string>('');
  endDate = signal<string>('');

  keywordMode = signal<'all' | 'selected' | 'custom' | 'none'>('all');
  selectedKeywordsList = signal<string[]>([]);
  customKeywordsInput = signal<string>('');
  keywordSearchQuery = signal<string>('');

  // Skaner holati va natijalari
  isScanning = signal<boolean>(false);
  hasScanned = signal<boolean>(false);
  posts = signal<InspectedPost[]>([]);
  scanSummary = signal<{ scannedChannels: number; totalFound: number; skippedPrivate: number } | null>(null);

  // Tanlov va filtrlash
  resultsFilter = signal<'all' | 'unsent' | 'sent'>('all');
  resultsSearchQuery = signal<string>('');
  selectedPostIds = signal<Set<string>>(new Set());

  // Modal oynalar
  forwardModalOpen = signal<boolean>(false);
  forwardTargetType = signal<'groupType' | 'customTarget'>('groupType');
  selectedGroupType = signal<'GOOD' | 'BAD' | 'NEUTRAL'>('GOOD');
  customTargetInput = signal<string>('');
  isForwarding = signal<boolean>(false);
  forwardResult = signal<{ success: boolean; message: string } | null>(null);

  // Tanlangan bitta post tafsiloti
  detailPost = signal<InspectedPost | null>(null);
  detailModalOpen = signal<boolean>(false);

  // Filtrlangan natijalar
  readonly filteredPosts = computed(() => {
    let list = this.posts();
    const filter = this.resultsFilter();
    const query = this.resultsSearchQuery().toLowerCase().trim();

    if (filter === 'unsent') {
      list = list.filter((p) => !p.isAlreadySent);
    } else if (filter === 'sent') {
      list = list.filter((p) => p.isAlreadySent);
    }

    if (!query) return list;
    return list.filter(
      (p) =>
        (p.text || '').toLowerCase().includes(query) ||
        (p.channelTitle || '').toLowerCase().includes(query) ||
        (p.channel || '').toLowerCase().includes(query) ||
        (p.matchedKeywords || []).some((k) => k.toLowerCase().includes(query)),
    );
  });

  readonly unsentCount = computed(() => this.posts().filter((p) => !p.isAlreadySent).length);
  readonly sentCount = computed(() => this.posts().filter((p) => p.isAlreadySent).length);

  readonly filteredDbKeywords = computed(() => {
    const q = this.keywordSearchQuery().toLowerCase().trim();
    const all = this._dbKeywords();
    if (!q) return all;
    return all.filter((k) => k.toLowerCase().includes(q));
  });

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.applyPreset('24h');
  }

  applyPreset(preset: '3h' | 'today' | '24h' | '3d' | 'custom'): void {
    this.presetRange.set(preset);
    const now = new Date();
    let start = new Date();

    if (preset === '3h') {
      start.setHours(now.getHours() - 3);
    } else if (preset === 'today') {
      start.setHours(0, 0, 0, 0);
    } else if (preset === '24h') {
      start.setHours(now.getHours() - 24);
    } else if (preset === '3d') {
      start.setDate(now.getDate() - 3);
    } else {
      return;
    }

    this.startDate.set(this.formatDateForInput(start));
    this.endDate.set(this.formatDateForInput(now));
  }

  private formatDateForInput(d: Date): string {
    const pad = (n: number) => (n < 10 ? '0' + n : n);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  toggleKeywordSelection(k: string): void {
    const current = this.selectedKeywordsList();
    if (current.includes(k)) {
      this.selectedKeywordsList.set(current.filter((x) => x !== k));
    } else {
      this.selectedKeywordsList.set([...current, k]);
    }
  }

  toggleChannelSelection(ident: string): void {
    const current = this.selectedChannelIdents();
    if (current.includes(ident)) {
      this.selectedChannelIdents.set(current.filter((x) => x !== ident));
    } else {
      this.selectedChannelIdents.set([...current, ident]);
    }
  }

  startScan(): void {
    if (!this.startDate() || !this.endDate()) {
      return;
    }

    this.isScanning.set(true);
    this.hasScanned.set(false);
    this.posts.set([]);
    this.selectedPostIds.set(new Set());
    this.scanSummary.set(null);

    // Tayyorlash
    let customKw: string[] = [];
    if (this.keywordMode() === 'custom') {
      customKw = this.customKeywordsInput()
        .split(/[\n,]+/)
        .map((x) => x.trim())
        .filter((x) => x.length > 0);
    }

    const payload: any = {
      startDate: new Date(this.startDate()).toISOString(),
      endDate: new Date(this.endDate()).toISOString(),
      keywordMode: this.keywordMode(),
      selectedKeywords: this.selectedKeywordsList(),
      customKeywords: customKw,
    };

    if (this.channelScope() === 'custom') {
      payload.customChannel = this.customChannelInput().trim();
    } else if (this.channelScope() === 'selected') {
      payload.channels = this.selectedChannelIdents();
    } else {
      payload.channels = ['all'];
    }

    this.api.scanHistoricalRange(payload).subscribe({
      next: (res: any) => {
        this.isScanning.set(false);
        this.hasScanned.set(true);
        if (res.success) {
          this.posts.set(res.posts || []);
          this.scanSummary.set({
            scannedChannels: res.totalScannedChannels || 0,
            totalFound: res.totalFound || 0,
            skippedPrivate: res.skippedPrivateChannels || 0,
          });
        }
      },
      error: () => {
        this.isScanning.set(false);
        this.hasScanned.set(true);
      },
    });
  }

  // Tanlovlar bilan ishlash
  togglePostSelect(id: string): void {
    const current = new Set(this.selectedPostIds());
    if (current.has(id)) {
      current.delete(id);
    } else {
      current.add(id);
    }
    this.selectedPostIds.set(current);
  }

  selectAllFiltered(): void {
    const ids = new Set(this.filteredPosts().map((p) => p.uniqueId));
    this.selectedPostIds.set(ids);
  }

  selectUnsentOnly(): void {
    const ids = new Set(this.filteredPosts().filter((p) => !p.isAlreadySent).map((p) => p.uniqueId));
    this.selectedPostIds.set(ids);
  }

  clearSelection(): void {
    this.selectedPostIds.set(new Set());
  }

  openForwardModal(): void {
    if (this.selectedPostIds().size === 0) return;
    this.forwardResult.set(null);
    this.forwardModalOpen.set(true);
  }

  submitForward(): void {
    const ids = this.selectedPostIds();
    const selectedPosts = this.posts().filter((p) => ids.has(p.uniqueId));
    if (selectedPosts.length === 0) return;

    this.isForwarding.set(true);
    this.forwardResult.set(null);

    const payload = {
      posts: selectedPosts.map((p) => ({
        rawChatId: p.rawChatId,
        rawMsgId: p.rawMsgId,
        text: p.text,
        postLink: p.postLink,
        uniqueId: p.uniqueId,
        channelTitle: p.channelTitle,
      })),
      targetMode: this.forwardTargetType(),
      groupType: this.selectedGroupType(),
      customTarget: this.customTargetInput().trim(),
      markAsSentInDb: true,
    };

    this.api.forwardInspectedPosts(payload).subscribe({
      next: (res: any) => {
        this.isForwarding.set(false);
        if (res.success) {
          this.forwardResult.set({
            success: true,
            message: `${res.forwardedCount} ta post muvaffaqiyatli yo'naltirildi!`,
          });
          // Update status locally
          this.posts.update((list) =>
            list.map((p) => {
              if (ids.has(p.uniqueId)) {
                return { ...p, isAlreadySent: true, existingStatus: 'SENT' };
              }
              return p;
            }),
          );
          setTimeout(() => {
            this.forwardModalOpen.set(false);
            this.clearSelection();
          }, 1500);
        } else {
          this.forwardResult.set({
            success: false,
            message: res.error || 'Yo\'naltirishda xatolik yuz berdi',
          });
        }
      },
      error: (err: any) => {
        this.isForwarding.set(false);
        this.forwardResult.set({
          success: false,
          message: err?.error?.error || 'Server bilan bog\'lanishda xatolik',
        });
      },
    });
  }

  openDetail(post: InspectedPost): void {
    this.detailPost.set(post);
    this.detailModalOpen.set(true);
  }

  formatDate(iso: string): string {
    if (!iso) return '-';
    try {
      const d = new Date(iso);
      return d.toLocaleString('uz-UZ', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  }
}
