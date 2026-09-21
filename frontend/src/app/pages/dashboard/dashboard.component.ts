import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ButtonComponent } from '../../components/ui/button/button.component';
import { BadgeComponent } from '../../components/ui/badge/badge.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { ChannelsComponent } from './components/channels/channels.component';
import { KeywordsComponent } from './components/keywords/keywords.component';
import { GroupsComponent } from './components/groups/groups.component';
import { HistoryComponent } from './components/history/history.component';
import { SystemStatusComponent } from './components/system-status/system-status.component';
import { LogsComponent } from './components/logs/logs.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonComponent,
    BadgeComponent,
    SidebarComponent,
    ChannelsComponent,
    KeywordsComponent,
    GroupsComponent,
    HistoryComponent,
    SystemStatusComponent,
    LogsComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit {
  activeSection = signal<string>('channels');
  sidebarCollapsed = signal<boolean>(false);
  mobileSidebarOpen = signal<boolean>(false);
  status = signal<any>(null);
  loading = signal<boolean>(false);
  toast = signal<any>(null);

  channels = signal<any[]>([]);
  keywords = signal<string[]>([]);
  groups = signal<any[]>([]);
  history = signal<any[]>([]);

  constructor(
    private api: ApiService,
    private auth: AuthService,
  ) {}

  ngOnInit(): void {
    this.refreshAll();
  }

  toggleSidebar(): void {
    if (typeof window !== 'undefined' && window.innerWidth <= 1024) {
      this.mobileSidebarOpen.set(!this.mobileSidebarOpen());
    } else {
      this.sidebarCollapsed.set(!this.sidebarCollapsed());
    }
  }

  closeMobileSidebar(): void {
    this.mobileSidebarOpen.set(false);
  }

  refreshAll(): void {
    this.loading.set(true);
    this.loadStatus();
    this.loadChannels();
    this.loadKeywords();
    this.loadGroups();
    this.loadHistory();
    setTimeout(() => this.loading.set(false), 400);
  }

  loadStatus(): void {
    this.api.getStatus().subscribe({
      next: (data: any) => this.status.set(data),
      error: () => this.showToast('Holatni yuklashda xatolik', 'error'),
    });
  }

  loadChannels(): void {
    this.api.getChannels().subscribe({
      next: (res: any) => {
        const list = res.channelDetails || res.channels || [];
        this.channels.set(list);
      },
      error: () => this.showToast('Kanallarni yuklashda xatolik', 'error'),
    });
  }

  handleAddChannel(ident: string): void {
    this.api.addChannel(ident).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.showToast(`Kanal qo'shildi: ${ident}`, 'success');
          this.loadChannels();
          this.loadStatus();
        } else {
          this.showToast('Bu kanal avvaldan mavjud', 'error');
        }
      },
      error: () => this.showToast('Kanal qoʻshishda xatolik', 'error'),
    });
  }

  handleUpdateChannel(data: any): void {
    this.api.updateChannel(data.oldIdent, data.newIdent).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.showToast(`Kanal yangilandi: ${data.newIdent}`, 'success');
          this.loadChannels();
        } else {
          this.showToast('Kanalni yangilashda xatolik', 'error');
        }
      },
      error: () => this.showToast('Kanalni yangilashda xatolik', 'error'),
    });
  }

  handleDeleteChannel(ident: string): void {
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

  handleAddKeyword(word: string): void {
    this.api.addKeyword(word).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.showToast(`Kalit soʻz qo'shildi: ${word}`, 'success');
          this.loadKeywords();
          this.loadStatus();
        } else {
          this.showToast('Bu soʻz mavjud yoki juda qisqa', 'error');
        }
      },
      error: () => this.showToast('Kalit soʻz qoʻshishda xatolik', 'error'),
    });
  }

  handleUpdateKeyword(data: any): void {
    this.api.updateKeyword(data.oldWord, data.newWord).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.showToast(`Kalit so'z yangilandi: ${data.newWord}`, 'success');
          this.loadKeywords();
        } else {
          this.showToast('Kalit soʻzni yangilashda xatolik', 'error');
        }
      },
      error: () => this.showToast('Kalit soʻzni yangilashda xatolik', 'error'),
    });
  }

  handleDeleteKeyword(word: string): void {
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

  handleAddGroup(data: any): void {
    this.api.addGroup(data.id, data.type).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.showToast(`Guruh qo'shildi: ${data.id}`, 'success');
          this.loadGroups();
          this.loadStatus();
        } else {
          this.showToast('Guruh avvaldan mavjud', 'error');
        }
      },
      error: () => this.showToast('Guruh qoʻshishda xatolik', 'error'),
    });
  }

  handleUpdateGroup(data: any): void {
    this.api.updateGroup(data.oldGroupId, data.oldType, data.newGroupId, data.newType).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.showToast('Guruh muvaffaqiyatli yangilandi', 'success');
          this.loadGroups();
        } else {
          this.showToast('Guruhni yangilashda xatolik', 'error');
        }
      },
      error: () => this.showToast('Guruhni yangilashda xatolik', 'error'),
    });
  }

  handleDeleteGroup(data: any): void {
    this.api.deleteGroup(data.groupId, data.type).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.showToast(`Guruh oʻchirildi: ${data.groupId}`, 'success');
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

  handleDeleteHistoryItem(id: string): void {
    this.api.deleteHistoryItem(id).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.showToast('Xabar tarixdan oʻchirildi', 'success');
          this.loadHistory();
          this.loadStatus();
        }
      },
      error: () => this.showToast('Xabarni oʻchirishda xatolik', 'error'),
    });
  }

  handleClearHistory(): void {
    this.api.clearHistory().subscribe({
      next: (res: any) => {
        if (res.success) {
          this.showToast('Barcha xabarlar tarixi tozalandi', 'success');
          this.loadHistory();
          this.loadStatus();
        }
      },
      error: () => this.showToast('Tarixni tozalashda xatolik', 'error'),
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
}
