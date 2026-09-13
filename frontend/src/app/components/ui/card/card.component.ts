import { Component, Input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { hlm } from '../../../core/hlm';

@Component({
  selector: 'hlm-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './card.component.html',
  styleUrl: './card.component.css',
  host: {
    '[class]': 'classes()',
  },
})
export class CardComponent {
  @Input() class: string = '';

  readonly classes = computed(() => {
    return hlm(
      'rounded-xl border border-slate-800 bg-slate-900/60 text-slate-100 shadow-md backdrop-blur-md p-6 block',
      this.class,
    );
  });
}
