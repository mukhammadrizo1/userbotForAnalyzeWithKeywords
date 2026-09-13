import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private get base(): string {
    const custom = localStorage.getItem('backend_url');
    return `${custom || environment.apiUrl || ''}/api`;
  }

  constructor(private http: HttpClient) {}


  getStatus(): Observable<any> {
    return this.http.get<any>(`${this.base}/status`);
  }

  getChannels(): Observable<any> {
    return this.http.get<any>(`${this.base}/channels`);
  }

  addChannel(ident: string): Observable<any> {
    return this.http.post<any>(`${this.base}/channels`, { ident });
  }

  deleteChannel(ident: string): Observable<any> {
    return this.http.delete<any>(`${this.base}/channels/${encodeURIComponent(ident)}`);
  }

  getKeywords(): Observable<any> {
    return this.http.get<any>(`${this.base}/keywords`);
  }

  addKeyword(word: string): Observable<any> {
    return this.http.post<any>(`${this.base}/keywords`, { word });
  }

  deleteKeyword(word: string): Observable<any> {
    return this.http.delete<any>(`${this.base}/keywords/${encodeURIComponent(word)}`);
  }

  getGroups(type?: string): Observable<any> {
    const url = type ? `${this.base}/groups?type=${type}` : `${this.base}/groups`;
    return this.http.get<any>(url);
  }

  addGroup(groupId: string, type: string): Observable<any> {
    return this.http.post<any>(`${this.base}/groups`, { group_id: groupId, type });
  }

  deleteGroup(groupId: string, type: string): Observable<any> {
    return this.http.delete<any>(
      `${this.base}/groups/${encodeURIComponent(type)}/${encodeURIComponent(groupId)}`,
    );
  }

  getHistory(limit: number = 50): Observable<any> {
    return this.http.get<any>(`${this.base}/history?limit=${limit}`);
  }

  ping(): Observable<any> {
    return this.http.get<any>(`${this.base}/ping`);
  }
}
