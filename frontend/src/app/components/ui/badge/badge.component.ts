import { Component, Input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { cva } from 'class-variance-authority';
import { hlm } from '../../../core/hlm';

export const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-blue-600/20 text-blue-400 border-blue-500/30',
        secondary: 'border-transparent bg-slate-800 text-slate-300',
        destructive: 'border-transparent bg-rose-500/20 text-rose-400 border-rose-500/30',
        success: 'border-transparent bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        warning: 'border-transparent bg-amber-500/20 text-amber-400 border-amber-500/30',
        outline: 'text-slate-300 border-slate-700',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

@Component({
  selector: 'hlm-badge, span[hlmBadge]',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './badge.component.html',
  styleUrl: './badge.component.css',
  host: {
    '[class]': 'classes()',
  },
})
export class BadgeComponent {
  @Input() variant: any = 'default';
  @Input() class: string = '';

  readonly classes = computed(() => {
    return hlm(badgeVariants({ variant: this.variant }), this.class);
  });
}
