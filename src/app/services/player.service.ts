// services/player.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, tap } from 'rxjs';
import { Player, MatchEntry } from '../models/player.model';

@Injectable({ providedIn: 'root' })
export class PlayerService {
    private apiUrl = 'http://localhost:3000/api';

    private playersSubject = new BehaviorSubject<Player[]>([]);
    players$ = this.playersSubject.asObservable();

    constructor(private http: HttpClient) { }

    /** Fetch all players and cache in BehaviorSubject */
    loadPlayers(): Observable<Player[]> {
        return this.http.get<Player[]>(`${this.apiUrl}/players`).pipe(
            tap(players => this.playersSubject.next(players))
        );
    }

    /** Get a single player by name */
    getPlayer(name: string): Observable<Player> {
        return this.http.get<Player>(`${this.apiUrl}/players/${name}`);
    }

    /** Full stats overwrite */
    updatePlayer(name: string, data: Partial<Player>): Observable<Player> {
        return this.http.put<Player>(`${this.apiUrl}/players/${name}`, data).pipe(
            tap(() => this.loadPlayers().subscribe())
        );
    }

    /**
     * Add a match result — backend will compute deltas and update both players.
     * POST /api/matches
     */
    addMatch(matchEntry: MatchEntry): Observable<{ me: Player; friend: Player }> {
        return this.http.post<{ me: Player; friend: Player }>(`${this.apiUrl}/matches`, matchEntry).pipe(
            tap(res => {
                const current = this.playersSubject.getValue();
                const updated = current.map(p => {
                    if (p.name === res.me.name) return res.me;
                    if (p.name === res.friend.name) return res.friend;
                    return p;
                });
                this.playersSubject.next(updated);
            })
        );
    }
}