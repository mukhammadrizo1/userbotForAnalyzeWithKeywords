import { Component, Input, Output, EventEmitter, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '../../../../components/ui/button/button.component';
import { InputComponent } from '../../../../components/ui/input/input.component';
import { BadgeComponent } from '../../../../components/ui/badge/badge.component';
import { DialogComponent } from '../../../../components/ui/dialog/dialog.component';
import { ConfirmModalComponent } from '../../../../components/ui/confirm-modal/confirm-modal.component';

@Component({
  selector: 'app-keywords',
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
  templateUrl: './keywords.component.html',
  styleUrl: './keywords.component.css',
})
export class KeywordsComponent {
  @Input() set keywords(val: string[]) {
    this._keywords.set(val || []);
  }
  @Output() addKeyword = new EventEmitter<string>();
  @Output() updateKeyword = new EventEmitter<any>();
  @Output() deleteKeyword = new EventEmitter<string>();

  _keywords = signal<string[]>([]);
  searchQuery = signal<string>('');

  addModalOpen = signal<boolean>(false);
  editModalOpen = signal<boolean>(false);
  detailModalOpen = signal<boolean>(false);
  confirmModalOpen = signal<boolean>(false);

  newKeywordInput = signal<string>('');
  selectedKeyword = signal<string>('');
  editKeywordInput = signal<string>('');

  readonly filtered = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const list = this._keywords();
    if (!q) return list;
    return list.filter((k) => (k || '').toLowerCase().includes(q));
  });

  openAddModal(): void {
    this.newKeywordInput.set('');
    this.addModalOpen.set(true);
  }

  submitAdd(): void {
    const val = this.newKeywordInput().trim();
    if (!val) return;
    this.addKeyword.emit(val);
    this.addModalOpen.set(false);
  }

  openDetail(word: string): void {
    this.selectedKeyword.set(word);
    this.detailModalOpen.set(true);
  }

  openEdit(word: string): void {
    this.selectedKeyword.set(word);
    this.editKeywordInput.set(word);
    this.detailModalOpen.set(false);
    this.editModalOpen.set(true);
  }

  submitEdit(): void {
    const newWord = this.editKeywordInput().trim();
    const oldWord = this.selectedKeyword();
    if (!newWord || newWord === oldWord) {
      this.editModalOpen.set(false);
      return;
    }
    this.updateKeyword.emit({ oldWord, newWord });
    this.editModalOpen.set(false);
  }

  promptDelete(word: string, fromDetail: boolean = false): void {
    this.selectedKeyword.set(word);
    if (fromDetail) {
      this.detailModalOpen.set(false);
    }
    this.confirmModalOpen.set(true);
  }

  confirmDelete(): void {
    const word = this.selectedKeyword();
    if (word) {
      this.deleteKeyword.emit(word);
    }
    this.confirmModalOpen.set(false);
  }
}
