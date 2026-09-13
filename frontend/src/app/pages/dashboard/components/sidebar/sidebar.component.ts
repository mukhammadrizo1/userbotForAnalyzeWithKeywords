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
  @Output() sectionChange = new EventEmitter<string>();
  @Output() logoutClick = new EventEmitter<void>();
  @Output() toggleCollapse = new EventEmitter<void>();

  selectSection(section: string): void {
    this.sectionChange.emit(section);
  }

  onLogout(): void {
    this.logoutClick.emit();
  }

  onToggle(): void {
    this.toggleCollapse.emit();
  }
}
