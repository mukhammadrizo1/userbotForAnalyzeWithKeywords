import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private tokenSignal = signal<string | null>(localStorage.getItem('token'));
  private userSignal = signal<any>(
    localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!) : null,
  );

  readonly isAuthenticated = computed(() => !!this.tokenSignal());
  readonly currentUser = computed(() => this.userSignal());

  constructor(
    private http: HttpClient,
    private router: Router,
  ) {}

  private getApiUrl(): string {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      if (host !== 'localhost' && host !== '127.0.0.1') {
        return environment.apiUrl || 'https://userbotforanalyzewithkeywords.fly.dev';
      }
    }
    return environment.apiUrl || 'https://userbotforanalyzewithkeywords.fly.dev';
  }

  login(credentials: any): Observable<any> {
    const url = `${this.getApiUrl()}/api/auth/login`;
    return this.http.post<any>(url, credentials).pipe(
      tap((res: any) => {
        if (res && res.access_token) {
          localStorage.setItem('token', res.access_token);
          localStorage.setItem('user', JSON.stringify(res.user));
          this.tokenSignal.set(res.access_token);
          this.userSignal.set(res.user);
        }
      }),
    );
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.tokenSignal.set(null);
    this.userSignal.set(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return this.tokenSignal();
  }
}
