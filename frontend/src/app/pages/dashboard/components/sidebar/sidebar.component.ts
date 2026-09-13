import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
})
export class SidebarComponent {
  @Input() activeSection: string = 'channels';
  @Input() counts: any = {};
  @Input() connected: boolean = false;
  @Input() botUser: any = null;
  @Input() collapsed: boolean = false;
  @Input() mobileOpen: boolean = false;
  @Output() sectionChange = new EventEmitter<string>();
  @Output() logoutClick = new EventEmitter<void>();
  @Output() toggleCollapse = new EventEmitter<void>();
  @Output() closeMobile = new EventEmitter<void>();

  selectSection(section: string): void {
    this.sectionChange.emit(section);
    this.closeMobile.emit();
  }

  onLogout(): void {
    this.logoutClick.emit();
    this.closeMobile.emit();
  }

  onToggle(): void {
    this.toggleCollapse.emit();
  }

  onCloseMobile(): void {
    this.closeMobile.emit();
  }
}
