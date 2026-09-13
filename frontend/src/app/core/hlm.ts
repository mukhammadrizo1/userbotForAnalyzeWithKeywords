import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function hlm(...inputs: any[]): string {
  return twMerge(clsx(inputs));
}
