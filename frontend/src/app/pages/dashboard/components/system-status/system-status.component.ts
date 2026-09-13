import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardComponent } from '../../../../components/ui/card/card.component';
import { BadgeComponent } from '../../../../components/ui/badge/badge.component';

@Component({
  selector: 'app-system-status',
  standalone: true,
  imports: [CommonModule, CardComponent, BadgeComponent],
  templateUrl: './system-status.component.html',
  styleUrl: './system-status.component.css',
})
export class SystemStatusComponent {
  @Input() status: any = null;

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
