import { Component, Input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { hlm } from '../../../core/hlm';

@Component({
  selector: 'input[hlmInput]',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './input.component.html',
  styleUrl: './input.component.css',
  host: {
    '[class]': 'classes()',
  },
})
export class InputComponent {
  @Input() class: string = '';

  readonly classes = computed(() => {
    return hlm(
      'flex h-10 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 transition-all',
      this.class,
    );
  });
}
