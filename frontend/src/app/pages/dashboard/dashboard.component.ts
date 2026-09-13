import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ButtonComponent } from '../../components/ui/button/button.component';
import { BadgeComponent } from '../../components/ui/badge/badge.component';
import { CardComponent } from '../../components/ui/card/card.component';
import { InputComponent } from '../../components/ui/input/input.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonComponent,
    BadgeComponent,
    CardComponent,
    InputComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit {

  activeTab = signal<string>('channels');
  status = signal<any>(null);
  loading = signal<boolean>(false);
  toast = signal<any>(null);

  channels = signal<string[]>([]);
  channelSearch = signal<string>('');
  newChannel = signal<string>('');

  keywords = signal<string[]>([]);
  keywordSearch = signal<string>('');
  newKeyword = signal<string>('');

  groups = signal<any[]>([]);
  newGroupId = signal<string>('');
  newGroupType = signal<string>('good');

  history = signal<any[]>([]);
  pingData = signal<any>(null);
  backendUrl = signal<string>(localStorage.getItem('backend_url') || '');

  saveBackendUrl(): void {
    const val = this.backendUrl().trim().replace(/\/+$/, '');
    if (val) {
      localStorage.setItem('backend_url', val);
    } else {
      localStorage.removeItem('backend_url');
    }
    this.showToast('Backend URL saqlandi', 'success');
    this.refreshAll();
  }


  readonly filteredChannels = computed(() => {
    const q = this.channelSearch().toLowerCase().trim();
    if (!q) return this.channels();
    return this.channels().filter((ch) => ch.toLowerCase().includes(q));
  });

  readonly filteredKeywords = computed(() => {
    const q = this.keywordSearch().toLowerCase().trim();
    if (!q) return this.keywords();
    return this.keywords().filter((kw) => kw.toLowerCase().includes(q));
  });

  readonly goodGroups = computed(() => {
    return this.groups().filter((g) => g.type === 'good');
  });

  readonly badGroups = computed(() => {
    return this.groups().filter((g) => g.type === 'bad');
  });

  readonly neutralGroups = computed(() => {
    return this.groups().filter((g) => g.type === 'neutral');
  });

  constructor(
    private api: ApiService,
    private auth: AuthService,
  ) {}

  ngOnInit(): void {
    this.refreshAll();
  }

  refreshAll(): void {
    this.loading.set(true);
    this.loadStatus();
    this.loadChannels();
    this.loadKeywords();
    this.loadGroups();
    this.loadHistory();
    setTimeout(() => this.loading.set(false), 500);
  }

  loadStatus(): void {
    this.api.getStatus().subscribe({
      next: (data: any) => this.status.set(data),
      error: () => this.showToast('Holatni yuklashda xatolik', 'error'),
    });
  }

  loadChannels(): void {
    this.api.getChannels().subscribe({
      next: (res: any) => this.channels.set(res.channels || []),
      error: () => this.showToast('Kanallarni yuklashda xatolik', 'error'),
    });
  }

  addChannel(): void {
    const val = this.newChannel().trim();
    if (!val) return;
    this.api.addChannel(val).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.showToast(`Kanal qo'shildi: ${val}`, 'success');
          this.newChannel.set('');
          this.loadChannels();
          this.loadStatus();
        } else {
          this.showToast('Bu kanal avvaldan mavjud', 'error');
        }
      },
      error: () => this.showToast('Kanal qoʻshishda xatolik', 'error'),
    });
  }

  deleteChannel(ident: string): void {
    if (!confirm(`"${ident}" kanalini o'chirishni tasdiqlaysizmi?`)) return;
    this.api.deleteChannel(ident).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.showToast(`Kanal oʻchirildi: ${ident}`, 'success');
          this.loadChannels();
          this.loadStatus();
        }
      },
      error: () => this.showToast('Kanalni oʻchirishda xatolik', 'error'),
    });
  }

  loadKeywords(): void {
    this.api.getKeywords().subscribe({
      next: (res: any) => this.keywords.set(res.keywords || []),
      error: () => this.showToast('Kalit soʻzlarni yuklashda xatolik', 'error'),
    });
  }

  addKeyword(): void {
    const val = this.newKeyword().trim();
    if (!val) return;
    this.api.addKeyword(val).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.showToast(`Kalit soʻz qo'shildi: ${val}`, 'success');
          this.newKeyword.set('');
          this.loadKeywords();
          this.loadStatus();
        } else {
          this.showToast('Bu soʻz mavjud yoki juda qisqa', 'error');
        }
      },
      error: () => this.showToast('Kalit soʻz qoʻshishda xatolik', 'error'),
    });
  }

  deleteKeyword(word: string): void {
    if (!confirm(`"${word}" kalit so'zini o'chirishni tasdiqlaysizmi?`)) return;
    this.api.deleteKeyword(word).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.showToast(`Kalit soʻz oʻchirildi: ${word}`, 'success');
          this.loadKeywords();
          this.loadStatus();
        }
      },
      error: () => this.showToast('Kalit soʻzni oʻchirishda xatolik', 'error'),
    });
  }

  loadGroups(): void {
    this.api.getGroups().subscribe({
      next: (res: any) => this.groups.set(res.groups || []),
      error: () => this.showToast('Guruhlarni yuklashda xatolik', 'error'),
    });
  }

  addGroup(): void {
    const gId = this.newGroupId().trim();
    const gType = this.newGroupType();
    if (!gId) return;

    this.api.addGroup(gId, gType).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.showToast(`Guruh qo'shildi: ${gId}`, 'success');
          this.newGroupId.set('');
          this.loadGroups();
          this.loadStatus();
        } else {
          this.showToast('Guruh avvaldan mavjud', 'error');
        }
      },
      error: () => this.showToast('Guruh qoʻshishda xatolik', 'error'),
    });
  }

  deleteGroup(groupId: string, type: string): void {
    if (!confirm(`"${groupId}" (${type}) guruhini o'chirishni tasdiqlaysizmi?`)) return;
    this.api.deleteGroup(groupId, type).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.showToast(`Guruh oʻchirildi: ${groupId}`, 'success');
          this.loadGroups();
          this.loadStatus();
        }
      },
      error: () => this.showToast('Guruhni oʻchirishda xatolik', 'error'),
    });
  }

  loadHistory(): void {
    this.api.getHistory(50).subscribe({
      next: (res: any) => this.history.set(res.history || []),
      error: () => this.showToast('Tarixni yuklashda xatolik', 'error'),
    });
  }

  testPing(): void {
    this.api.ping().subscribe({
      next: (data: any) => {
        this.pingData.set(data);
        this.showToast('Ping muvaffaqiyatli: ' + data.status, 'success');
      },
      error: () => this.showToast('Ping xatolik berdi', 'error'),
    });
  }

  showToast(message: string, type: 'success' | 'error'): void {
    this.toast.set({ message, type });
    setTimeout(() => {
      this.toast.set(null);
    }, 4000);
  }

  logout(): void {
    this.auth.logout();
  }

  formatUptime(seconds: number): string {
    if (!seconds) return '0 daqiqa';
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const parts = [];
    if (d > 0) parts.push(`${d} kun`);
    if (h > 0) parts.push(`${h} soat`);
    parts.push(`${m} daqiqa`);
    return parts.join(' ');
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('uz-UZ', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  }
}
