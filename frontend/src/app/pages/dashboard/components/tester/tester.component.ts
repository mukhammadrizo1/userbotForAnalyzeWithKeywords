import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../core/api.service';

@Component({
  selector: 'app-tester',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tester.component.html',
  styleUrl: './tester.component.css',
})
export class TesterComponent {
  testText = signal<string>('');
  isLoading = signal<boolean>(false);
  result = signal<any | null>(null);

  samplePrompts = [
    'Afrosiyob poyezdiga chipta topilmayapti, kassa xodimlari juda qo‘pol muomala qildi.',
    'Toshkent-Samarqand yo‘nalishidagi tezyurar poyezd o‘z vaqtida yetib keldi, vagonlar toza va qulay.',
    'Bugun O‘zbekistonda ob-havo keskin soviydi va yomg‘ir yog‘ishi kutilmoqda.',
    'Temir yo‘l chiptalari narxi oshirilishi mumkinligi haqida xabarlar tarqaldi.',
  ];

  constructor(private api: ApiService) {}

  setSample(text: string): void {
    this.testText.set(text);
  }

  runTest(): void {
    const text = this.testText().trim();
    if (!text) return;

    this.isLoading.set(true);
    this.result.set(null);

    this.api.testAi(text).subscribe({
      next: (res) => {
        this.result.set(res);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.result.set({
          error: true,
          message: err?.error?.message || 'Tahlil jarayonida xatolik yuz berdi',
        });
        this.isLoading.set(false);
      },
    });
  }

  clear(): void {
    this.testText.set('');
    this.result.set(null);
  }
}
