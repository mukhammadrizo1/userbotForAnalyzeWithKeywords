import { Component, Input, Output, EventEmitter, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '../../../../components/ui/button/button.component';
import { InputComponent } from '../../../../components/ui/input/input.component';
import { BadgeComponent } from '../../../../components/ui/badge/badge.component';
import { DialogComponent } from '../../../../components/ui/dialog/dialog.component';
import { ConfirmModalComponent } from '../../../../components/ui/confirm-modal/confirm-modal.component';

@Component({
  selector: 'app-history',
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
  templateUrl: './history.component.html',
  styleUrl: './history.component.css',
})
export class HistoryComponent {
  @Input() set history(val: any[]) {
    this._history.set(val || []);
  }
  @Output() refresh = new EventEmitter<void>();
  @Output() deleteItem = new EventEmitter<string>();
  @Output() clearAll = new EventEmitter<void>();

  _history = signal<any[]>([]);
  searchQuery = signal<string>('');

  detailModalOpen = signal<boolean>(false);
  confirmModalOpen = signal<boolean>(false);
  confirmClearAllOpen = signal<boolean>(false);

  selectedItem = signal<any>(null);
  copied = signal<boolean>(false);

  readonly filtered = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const list = this._history();
    if (!q) return list;
    return list.filter((h) => {
      const idMatch = (h.msg_unique_id || '').toLowerCase().includes(q);
      const chMatch = (h.channel || '').toLowerCase().includes(q);
      const senMatch = (h.sentiment || '').toLowerCase().includes(q);
      const textMatch = (h.text || '').toLowerCase().includes(q);
      return idMatch || chMatch || senMatch || textMatch;
    });
  });

  formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('uz-UZ', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return dateStr;
    }
  }

  onRefresh(): void {
    this.refresh.emit();
  }

  openDetail(item: any): void {
    this.selectedItem.set(item);
    this.copied.set(false);
    this.detailModalOpen.set(true);
  }

  promptDelete(item: any, fromDetail: boolean = false): void {
    this.selectedItem.set(item);
    if (fromDetail) {
      this.detailModalOpen.set(false);
    }
    this.confirmModalOpen.set(true);
  }

  confirmDelete(): void {
    const item = this.selectedItem();
    if (item && item.msg_unique_id) {
      this.deleteItem.emit(item.msg_unique_id);
    }
    this.confirmModalOpen.set(false);
  }

  promptClearAll(): void {
    this.confirmClearAllOpen.set(true);
  }

  confirmClear(): void {
    this.clearAll.emit();
    this.confirmClearAllOpen.set(false);
  }

  copyText(text: string): void {
    if (!text) return;
    navigator.clipboard.writeText(text);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }
}
