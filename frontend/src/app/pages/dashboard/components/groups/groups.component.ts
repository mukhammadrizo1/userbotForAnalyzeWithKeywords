import { Component, Input, Output, EventEmitter, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '../../../../components/ui/button/button.component';
import { InputComponent } from '../../../../components/ui/input/input.component';
import { BadgeComponent } from '../../../../components/ui/badge/badge.component';
import { DialogComponent } from '../../../../components/ui/dialog/dialog.component';
import { ConfirmModalComponent } from '../../../../components/ui/confirm-modal/confirm-modal.component';

@Component({
  selector: 'app-groups',
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
  templateUrl: './groups.component.html',
  styleUrl: './groups.component.css',
})
export class GroupsComponent {
  @Input() set groups(val: any[]) {
    this._groups.set(val || []);
  }
  @Output() addGroup = new EventEmitter<any>();
  @Output() updateGroup = new EventEmitter<any>();
  @Output() deleteGroup = new EventEmitter<any>();

  _groups = signal<any[]>([]);

  addModalOpen = signal<boolean>(false);
  editModalOpen = signal<boolean>(false);
  detailModalOpen = signal<boolean>(false);
  confirmModalOpen = signal<boolean>(false);

  newGroupId = signal<string>('');
  newGroupType = signal<string>('good');

  selectedGroup = signal<any>(null);
  editGroupId = signal<string>('');
  editGroupType = signal<string>('good');

  readonly goodGroups = computed(() => this._groups().filter((g) => g.type === 'good'));
  readonly badGroups = computed(() => this._groups().filter((g) => g.type === 'bad'));
  readonly neutralGroups = computed(() => this._groups().filter((g) => g.type === 'neutral'));

  openAddModal(type: string = 'good'): void {
    this.newGroupId.set('');
    this.newGroupType.set(type);
    this.addModalOpen.set(true);
  }

  submitAdd(): void {
    const id = this.newGroupId().trim();
    const type = this.newGroupType();
    if (!id) return;
    this.addGroup.emit({ id, type });
    this.addModalOpen.set(false);
  }

  openDetail(group: any): void {
    this.selectedGroup.set(group);
    this.detailModalOpen.set(true);
  }

  openEdit(group: any): void {
    this.selectedGroup.set(group);
    this.editGroupId.set(group.group_id);
    this.editGroupType.set(group.type);
    this.detailModalOpen.set(false);
    this.editModalOpen.set(true);
  }

  submitEdit(): void {
    const old = this.selectedGroup();
    const newGroupId = this.editGroupId().trim();
    const newType = this.editGroupType();
    if (!old || !newGroupId) return;
    this.updateGroup.emit({
      oldGroupId: old.group_id,
      oldType: old.type,
      newGroupId,
      newType,
    });
    this.editModalOpen.set(false);
  }

  promptDelete(group: any, fromDetail: boolean = false): void {
    this.selectedGroup.set(group);
    if (fromDetail) {
      this.detailModalOpen.set(false);
    }
    this.confirmModalOpen.set(true);
  }

  confirmDelete(): void {
    const g = this.selectedGroup();
    if (g) {
      this.deleteGroup.emit({ groupId: g.group_id, type: g.type });
    }
    this.confirmModalOpen.set(false);
  }

  getTypeLabel(type: string): string {
    if (type === 'good') return '🟢 Yaxshi (Ijobiy)';
    if (type === 'bad') return '🔴 Yomon (Shikoyat)';
    if (type === 'neutral') return '⚪️ Neytral (Savol)';
    return type;
  }

  getTelegramLink(groupId: string): string {
    const clean = (groupId || '').replace('@', '').trim();
    if (clean.startsWith('-100') || !isNaN(Number(clean))) {
      return '';
    }
    return `https://t.me/${clean}`;
  }
}
