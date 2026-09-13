import { Component, Input, Output, EventEmitter, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '../../../../components/ui/button/button.component';
import { InputComponent } from '../../../../components/ui/input/input.component';
import { BadgeComponent } from '../../../../components/ui/badge/badge.component';
import { DialogComponent } from '../../../../components/ui/dialog/dialog.component';
import { ConfirmModalComponent } from '../../../../components/ui/confirm-modal/confirm-modal.component';

@Component({
  selector: 'app-channels',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonComponent,
    InputComponent,
    BadgeComponent,
    DialogComponent,
    ConfirmModalComponent,
  ],
  templateUrl: './channels.component.html',
  styleUrl: './channels.component.css',
})
export class ChannelsComponent {
  @Input() set channels(val: string[]) {
    this._channels.set(val || []);
  }
  @Output() addChannel = new EventEmitter<string>();
  @Output() updateChannel = new EventEmitter<any>();
  @Output() deleteChannel = new EventEmitter<string>();

  _channels = signal<string[]>([]);
  searchQuery = signal<string>('');

  addModalOpen = signal<boolean>(false);
  editModalOpen = signal<boolean>(false);
  detailModalOpen = signal<boolean>(false);
  confirmModalOpen = signal<boolean>(false);

  newChannelInput = signal<string>('');
  selectedChannel = signal<string>('');
  editChannelInput = signal<string>('');

  readonly filtered = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const list = this._channels();
    if (!q) return list;
    return list.filter((c) => (c || '').toLowerCase().includes(q));
  });

  openAddModal(): void {
    this.newChannelInput.set('');
    this.addModalOpen.set(true);
  }

  submitAdd(): void {
    const val = this.newChannelInput().trim();
    if (!val) return;
    this.addChannel.emit(val);
    this.addModalOpen.set(false);
  }

  openDetail(channel: string): void {
    this.selectedChannel.set(channel);
    this.detailModalOpen.set(true);
  }

  openEdit(channel: string): void {
    this.selectedChannel.set(channel);
    this.editChannelInput.set(channel);
    this.detailModalOpen.set(false);
    this.editModalOpen.set(true);
  }

  submitEdit(): void {
    const newIdent = this.editChannelInput().trim();
    const oldIdent = this.selectedChannel();
    if (!newIdent || newIdent === oldIdent) {
      this.editModalOpen.set(false);
      return;
    }
    this.updateChannel.emit({ oldIdent, newIdent });
    this.editModalOpen.set(false);
  }

  promptDelete(channel: string, fromDetail: boolean = false): void {
    this.selectedChannel.set(channel);
    if (fromDetail) {
      this.detailModalOpen.set(false);
    }
    this.confirmModalOpen.set(true);
  }

  confirmDelete(): void {
    const ch = this.selectedChannel();
    if (ch) {
      this.deleteChannel.emit(ch);
    }
    this.confirmModalOpen.set(false);
  }

  getTelegramLink(channel: string): string {
    const clean = (channel || '').replace('@', '').replace('https://t.me/', '').trim();
    if (clean.startsWith('-100') || !isNaN(Number(clean))) {
      return '';
    }
    return `https://t.me/${clean}`;
  }
}
