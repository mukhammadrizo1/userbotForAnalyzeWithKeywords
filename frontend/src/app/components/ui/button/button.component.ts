import { Component, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { cva } from 'class-variance-authority';
import { hlm } from '../../../core/hlm';

export const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
  {
    variants: {
      variant: {
        default: 'bg-blue-600 text-white shadow hover:bg-blue-700 active:bg-blue-800',
        destructive: 'bg-rose-600 text-white shadow-sm hover:bg-rose-700',
        outline: 'border border-slate-700 bg-slate-900/50 hover:bg-slate-800 text-slate-100',
        secondary: 'bg-slate-800 text-slate-100 hover:bg-slate-700',
        ghost: 'hover:bg-slate-800 hover:text-slate-100 text-slate-300',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-9 w-9 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

@Component({
  selector: 'hlm-button, button[hlmBtn], a[hlmBtn]',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './button.component.html',
  styleUrl: './button.component.css',
  host: {
    '[class]': 'classes()',
    '[attr.disabled]': 'disabled ? "" : null',
  },

})
export class ButtonComponent {
  @Input() variant: any = 'default';
  @Input() size: any = 'default';
  @Input() class: string = '';
  @Input() disabled: boolean = false;

  readonly classes = computed(() => {
    return hlm(buttonVariants({ variant: this.variant, size: this.size }), this.class);
  });
}
