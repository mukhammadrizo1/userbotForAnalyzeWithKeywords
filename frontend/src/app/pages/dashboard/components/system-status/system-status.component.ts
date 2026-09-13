import { Component, Input, Output, EventEmitter, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardComponent } from '../../../../components/ui/card/card.component';
import { BadgeComponent } from '../../../../components/ui/badge/badge.component';
import { ButtonComponent } from '../../../../components/ui/button/button.component';
import { InputComponent } from '../../../../components/ui/input/input.component';
import { DialogComponent } from '../../../../components/ui/dialog/dialog.component';
import { ConfirmModalComponent } from '../../../../components/ui/confirm-modal/confirm-modal.component';
import { ApiService } from '../../../../core/api.service';

@Component({
  selector: 'app-system-status',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardComponent,
    BadgeComponent,
    ButtonComponent,
    InputComponent,
    DialogComponent,
    ConfirmModalComponent,
  ],
  templateUrl: './system-status.component.html',
  styleUrl: './system-status.component.css',
})
export class SystemStatusComponent implements OnInit {
  @Input() status: any = null;
  @Output() statusChanged = new EventEmitter<void>();

  syncStatus = signal<any>(null);
  syncLoading = signal<boolean>(false);
  autoJoining = signal<boolean>(false);
  reconnecting = signal<boolean>(false);
  disconnecting = signal<boolean>(false);

  isConnectModalOpen = signal<boolean>(false);
  isDisconnectModalOpen = signal<boolean>(false);
  isAutoJoinModalOpen = signal<boolean>(false);

  connectStep = signal<number>(1);
  connectLoading = signal<boolean>(false);
  connectError = signal<string>('');
  phone = signal<string>('');
  code = signal<string>('');
  password = signal<string>('');
  phoneCodeHash = signal<string>('');
  autoJoinResult = signal<any>(null);

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.checkSync();
  }

  checkSync(): void {
    this.syncLoading.set(true);
    this.api.getTelegramSyncStatus().subscribe({
      next: (res: any) => {
        this.syncStatus.set(res);
        this.syncLoading.set(false);
      },
      error: () => {
        this.syncLoading.set(false);
      },
    });
  }

  openConnectModal(): void {
    this.connectStep.set(1);
    this.connectError.set('');
    this.phone.set('');
    this.code.set('');
    this.password.set('');
    this.phoneCodeHash.set('');
    this.isConnectModalOpen.set(true);
  }

  closeConnectModal(): void {
    this.isConnectModalOpen.set(false);
  }

  sendCode(): void {
    if (!this.phone().trim()) {
      this.connectError.set('Telefon raqamni kiriting');
      return;
    }
    this.connectLoading.set(true);
    this.connectError.set('');
    this.api.sendTelegramCode(this.phone().trim()).subscribe({
      next: (res: any) => {
        this.phoneCodeHash.set(res.phoneCodeHash);
        this.connectStep.set(2);
        this.connectLoading.set(false);
      },
      error: (err: any) => {
        this.connectError.set(err?.error?.message || err?.message || 'Kodni yuborishda xatolik yuz berdi');
        this.connectLoading.set(false);
      },
    });
  }

  verifyCode(): void {
    if (!this.code().trim()) {
      this.connectError.set('Telegram tasdiqlash kodini kiriting');
      return;
    }
    this.connectLoading.set(true);
    this.connectError.set('');
    this.api.verifyTelegramCode(
      this.phone().trim(),
      this.code().trim(),
      this.phoneCodeHash(),
      this.password().trim() || undefined,
    ).subscribe({
      next: (res: any) => {
        if (res.needPassword) {
          this.connectError.set('Ikki bosqichli autentifikatsiya (2FA) parolini kiriting');
          this.connectLoading.set(false);
          return;
        }
        this.connectLoading.set(false);
        this.closeConnectModal();
        this.statusChanged.emit();
        this.checkSync();
      },
      error: (err: any) => {
        this.connectError.set(err?.error?.message || err?.message || 'Kodni tasdiqlashda xatolik');
        this.connectLoading.set(false);
      },
    });
  }

  openDisconnectModal(): void {
    this.isDisconnectModalOpen.set(true);
  }

  closeDisconnectModal(): void {
    this.isDisconnectModalOpen.set(false);
  }

  confirmDisconnect(): void {
    this.disconnecting.set(true);
    this.api.disconnectTelegram().subscribe({
      next: () => {
        this.disconnecting.set(false);
        this.closeDisconnectModal();
        this.statusChanged.emit();
        this.checkSync();
      },
      error: () => {
        this.disconnecting.set(false);
        this.closeDisconnectModal();
      },
    });
  }

  reconnect(): void {
    this.reconnecting.set(true);
    this.api.reconnectTelegram().subscribe({
      next: () => {
        this.reconnecting.set(false);
        this.statusChanged.emit();
        this.checkSync();
      },
      error: () => {
        this.reconnecting.set(false);
      },
    });
  }

  openAutoJoinModal(): void {
    this.isAutoJoinModalOpen.set(true);
  }

  closeAutoJoinModal(): void {
    this.isAutoJoinModalOpen.set(false);
  }

  confirmAutoJoin(): void {
    this.closeAutoJoinModal();
    this.autoJoining.set(true);
    this.autoJoinResult.set(null);
    this.api.autoJoinTelegramChannels().subscribe({
      next: (res: any) => {
        this.autoJoining.set(false);
        this.autoJoinResult.set(res);
        if (res.sync) {
          this.syncStatus.set(res.sync);
        } else {
          this.checkSync();
        }
        this.statusChanged.emit();
      },
      error: (err: any) => {
        this.autoJoining.set(false);
        this.autoJoinResult.set({
          success: false,
          error: err?.error?.message || err?.message || 'Aʼzo boʻlishda xatolik',
        });
      },
    });
  }

  getChannelSyncPercentage(): number {
    const s = this.syncStatus();
    if (!s || !s.totalChannels) return 0;
    return Math.round((s.joinedChannels / s.totalChannels) * 100);
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
}
