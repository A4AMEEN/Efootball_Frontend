// app.component.ts  —  Angular 21 standalone
import {
  Component, OnInit, OnDestroy, ViewChild, ElementRef,
  ChangeDetectorRef, PLATFORM_ID, Inject
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { trigger, transition, style, animate, query, stagger } from '@angular/animations';
import { Subscription, BehaviorSubject, tap } from 'rxjs';

// ─────────────────────────────────────────────────────────────
//  Interfaces
// ─────────────────────────────────────────────────────────────
export interface PlayerStats {
  totalMatches: number; totalGoals: number; wins: number; draws: number; losses: number;
  penaltyGoals: number; freekickGoals: number; cornerGoals: number; ownGoals: number;
}
export interface Player {
  _id?: string; name: string; stats: PlayerStats; concededMatches: number;
}
export interface MatchEntry {
  matchDate: string; result: string;
  me_normalGoals: number; me_penaltyGoals: number; me_freekickGoals: number;
  me_cornerGoals: number; me_ownGoals: number;
  friend_normalGoals: number; friend_penaltyGoals: number; friend_freekickGoals: number;
  friend_cornerGoals: number; friend_ownGoals: number;
}
export interface HistoryMatch extends MatchEntry { _id?: string; }
export interface StatDef {
  key: string; label: string; icon: string; isRoot: boolean; lowerBetter?: boolean; section?: string;
}
export interface MatchForm {
  [key: string]: number;
  me_n: number; me_p: number; me_f: number; me_c: number; me_og: number;
  fr_n: number; fr_p: number; fr_f: number; fr_c: number; fr_og: number;
}

// ─────────────────────────────────────────────────────────────
//  Component
// ─────────────────────────────────────────────────────────────
@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.html',
  styleUrls: ['./app.scss'],
  imports: [
    CommonModule,   // *ngIf, *ngFor, DatePipe, async
    FormsModule,    // [(ngModel)]
  ],
  animations: [
    trigger('fadeSlide', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(16px)' }),
        animate('380ms cubic-bezier(.4,0,.2,1)', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('220ms ease', style({ opacity: 0, transform: 'translateY(-10px)' }))
      ])
    ]),
    trigger('listAnim', [
      transition(':enter', [
        query('.stat-card, .sec-label', [
          style({ opacity: 0, transform: 'translateX(-16px)' }),
          stagger(30, animate('300ms ease', style({ opacity: 1, transform: 'none' })))
        ], { optional: true })
      ])
    ]),
    trigger('cardAnim', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.95)' }),
        animate('300ms cubic-bezier(.34,1.56,.64,1)', style({ opacity: 1, transform: 'scale(1)' }))
      ])
    ])
  ]
})
export class App implements OnInit, OnDestroy {

  @ViewChild('meFileInput') meFileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('friendFileInput') friendFileInput!: ElementRef<HTMLInputElement>;

  me: Player | null = null;
  friend: Player | null = null;

  viewMode: 'stats' | 'history' = 'stats';
  mePhoto = '';
  friendPhoto = '';
  matchHistory: HistoryMatch[] = [];

  showModal = false;
  submitLoading = false;
  currentResult: 'win' | 'draw' | 'loss' | null = null;
  matchDate = '';
  matchTime = '';
  match: MatchForm = this.freshMatch();
  editIndex: number | null = null;

  toastMessage = '';
  toastVisible = false;

  private API = 'https://erp-backend-sable-eta.vercel.app/api';
  private sub!: Subscription;
  private players$ = new BehaviorSubject<Player[]>([]);
  private isBrowser: boolean;   // ← guards all localStorage calls

  // ── Static definitions ────────────────────────────────────
  readonly statDefs: StatDef[] = [
    { key: 'totalMatches', label: 'Total Matches', icon: '📋', isRoot: false },
    { key: 'wins', label: 'Wins', icon: '🏆', isRoot: false },
    { key: 'draws', label: 'Draws', icon: '🤝', isRoot: false },
    { key: 'losses', label: 'Losses', icon: '💀', isRoot: false, lowerBetter: true },
    { key: 'totalGoals', label: 'Total Goals', icon: '⚽', isRoot: false, section: 'GOALS' },
    { key: 'penaltyGoals', label: 'Penalty Goals', icon: '🎯', isRoot: false },
    { key: 'freekickGoals', label: 'Freekick Goals', icon: '🌀', isRoot: false },
    { key: 'cornerGoals', label: 'Corner Goals', icon: '📐', isRoot: false },
    { key: 'ownGoals', label: 'Own Goals', icon: '😬', isRoot: false, lowerBetter: true },
    { key: 'concededMatches', label: 'Conceded Matches', icon: '🛡️', isRoot: true, lowerBetter: true, section: 'DEFENCE' }
  ];
  readonly myGoalFields = [
    { key: 'me_n', label: 'Normal Goals', icon: '⚽' },
    { key: 'me_p', label: 'Penalty', icon: '🎯' },
    { key: 'me_f', label: 'Freekick', icon: '🌀' },
    { key: 'me_c', label: 'Corner', icon: '📐' },
  ];
  readonly friendGoalFields = [
    { key: 'fr_n', label: 'Normal Goals', icon: '⚽' },
    { key: 'fr_p', label: 'Penalty', icon: '🎯' },
    { key: 'fr_f', label: 'Freekick', icon: '🌀' },
    { key: 'fr_c', label: 'Corner', icon: '📐' },
  ];

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,             // ← fix NG0100
    @Inject(PLATFORM_ID) platformId: object      // ← fix localStorage
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    // ── Fix NG0100: call detectChanges() after async data lands ──
    this.sub = this.players$.subscribe(players => {
      this.me = players.find(p => p.name === 'Shakthi') ?? null;
      this.friend = players.find(p => p.name === 'Shynu') ?? null;
      this.cdr.detectChanges();   // tell Angular: re-check NOW, we just changed
    });

    this.loadPlayers();

    // ── Fix localStorage: only call in browser context ──
    if (this.isBrowser) {
      this.loadPhotos();
      this.loadHistory();
    }
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  // ── HTTP ──────────────────────────────────────────────────
  private loadPlayers(): void {
    this.http.get<Player[]>(`${this.API}/players`).pipe(
      tap(p => this.players$.next(p))
    ).subscribe({
      error: () => {
        // Backend offline → empty baseline so UI still renders
        this.players$.next([
          { name: 'Shakthi', stats: { totalMatches: 0, totalGoals: 0, wins: 0, draws: 0, losses: 0, penaltyGoals: 0, freekickGoals: 0, cornerGoals: 0, ownGoals: 0 }, concededMatches: 0 },
          { name: 'Shynu', stats: { totalMatches: 0, totalGoals: 0, wins: 0, draws: 0, losses: 0, penaltyGoals: 0, freekickGoals: 0, cornerGoals: 0, ownGoals: 0 }, concededMatches: 0 }
        ]);
      }
    });
  }

  private postMatch(payload: MatchEntry) {
    return this.http.post<{ me: Player; friend: Player }>(`${this.API}/matches`, payload);
  }

  // ── localStorage helper (always guarded) ──────────────────
  private lsGet(key: string): string | null {
    return this.isBrowser ? localStorage.getItem(key) : null;
  }
  private lsSet(key: string, val: string): void {
    if (this.isBrowser) localStorage.setItem(key, val);
  }

  // ── Photos ────────────────────────────────────────────────
  triggerUpload(who: 'me' | 'friend'): void {
    if (who === 'me') this.meFileInput.nativeElement.click();
    else this.friendFileInput.nativeElement.click();
  }

  onPhotoSelect(event: Event, who: 'me' | 'friend'): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const b64 = e.target?.result as string;
      if (who === 'me') { this.mePhoto = b64; this.lsSet('efb_photo_me', b64); }
      else { this.friendPhoto = b64; this.lsSet('efb_photo_friend', b64); }
    };
    reader.readAsDataURL(file);
  }

  private loadPhotos(): void {
    this.mePhoto = this.lsGet('efb_photo_me') || '';
    this.friendPhoto = this.lsGet('efb_photo_friend') || '';
  }

  // ── View toggle ───────────────────────────────────────────
  toggleView(): void {
    this.viewMode = this.viewMode === 'stats' ? 'history' : 'stats';
  }

  // ── History ───────────────────────────────────────────────
  private loadHistory(): void {
    try {
      const s = this.lsGet('efb_history');
      this.matchHistory = s ? JSON.parse(s) : [];
    } catch { this.matchHistory = []; }
  }

  private saveHistory(): void {
    this.lsSet('efb_history', JSON.stringify(this.matchHistory));
  }

  openEditMatch(index: number): void {
    const m = this.matchHistory[index];
    this.editIndex = index;
    this.currentResult = m.result as 'win' | 'draw' | 'loss';
    this.match = {
      me_n: m.me_normalGoals, me_p: m.me_penaltyGoals,
      me_f: m.me_freekickGoals, me_c: m.me_cornerGoals, me_og: m.me_ownGoals,
      fr_n: m.friend_normalGoals, fr_p: m.friend_penaltyGoals,
      fr_f: m.friend_freekickGoals, fr_c: m.friend_cornerGoals, fr_og: m.friend_ownGoals,
    };
    const d = new Date(m.matchDate);
    this.matchDate = d.toISOString().slice(0, 10);
    this.matchTime = d.toTimeString().slice(0, 5);
    this.showModal = true;
  }

  // ── Stat helpers ──────────────────────────────────────────
  getVal(player: Player, def: StatDef): number {
    if (def.isRoot) return player.concededMatches ?? 0;
    return (player.stats as any)[def.key] ?? 0;
  }

  winRate(player: Player): number {
    if (!player.stats.totalMatches) return 0;
    return Math.round((player.stats.wins / player.stats.totalMatches) * 100);
  }

  h2hPercent(): number {
    const total = (this.me?.stats.wins ?? 0) + (this.friend?.stats.wins ?? 0);
    return total ? Math.round(((this.me?.stats.wins ?? 0) / total) * 100) : 50;
  }

  meWins(def: StatDef): boolean {
    if (!this.me || !this.friend) return false;
    const mv = this.getVal(this.me, def), fv = this.getVal(this.friend, def);
    return def.lowerBetter ? mv < fv : mv > fv;
  }

  friendWins(def: StatDef): boolean {
    if (!this.me || !this.friend) return false;
    const mv = this.getVal(this.me, def), fv = this.getVal(this.friend, def);
    return def.lowerBetter ? fv < mv : fv > mv;
  }

  isTie(def: StatDef): boolean {
    if (!this.me || !this.friend) return true;
    return this.getVal(this.me, def) === this.getVal(this.friend, def);
  }

  // ── Live goal totals ──────────────────────────────────────
  get myTotal(): number {
    return (this.match.me_n || 0) + (this.match.me_p || 0) + (this.match.me_f || 0) + (this.match.me_c || 0) + (this.match.fr_og || 0);
  }
  get friendTotal(): number {
    return (this.match.fr_n || 0) + (this.match.fr_p || 0) + (this.match.fr_f || 0) + (this.match.fr_c || 0) + (this.match.me_og || 0);
  }

  // ── Modal ─────────────────────────────────────────────────
  openModal(): void {
    this.editIndex = null;
    this.match = this.freshMatch();
    this.currentResult = null;
    const now = new Date();
    this.matchDate = now.toISOString().slice(0, 10);
    this.matchTime = now.toTimeString().slice(0, 5);
    this.showModal = true;
  }

  closeModal(): void { this.showModal = false; this.editIndex = null; }

  onOverlayClick(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('overlay')) this.closeModal();
  }

  setResult(r: 'win' | 'draw' | 'loss'): void { this.currentResult = r; }

  change(key: string, delta: number): void {
    this.match[key] = Math.max(0, (this.match[key] || 0) + delta);
  }

  submitMatch(): void {
    if (!this.currentResult) return;
    this.submitLoading = true;

    const payload: HistoryMatch = {
      matchDate: `${this.matchDate}T${this.matchTime}`,
      result: this.currentResult,
      me_normalGoals: this.match.me_n,
      me_penaltyGoals: this.match.me_p,
      me_freekickGoals: this.match.me_f,
      me_cornerGoals: this.match.me_c,
      me_ownGoals: this.match.me_og,
      friend_normalGoals: this.match.fr_n,
      friend_penaltyGoals: this.match.fr_p,
      friend_freekickGoals: this.match.fr_f,
      friend_cornerGoals: this.match.fr_c,
      friend_ownGoals: this.match.fr_og,
    };

    if (this.editIndex !== null) {
      this.reverseMatchLocally(this.matchHistory[this.editIndex]);
      this.matchHistory[this.editIndex] = payload;
      this.applyMatchLocally(payload);
      this.saveHistory();
      this.submitLoading = false;
      this.showModal = false;
      this.editIndex = null;
      this.showToast('✓ Match updated!');
    } else {
      this.matchHistory.unshift(payload);
      this.saveHistory();
      this.applyMatchLocally(payload);
      this.submitLoading = false;
      this.showModal = false;
      this.showToast('⚽ Match added!');
    }

    // Fire-and-forget backend sync
    this.postMatch(payload).subscribe({ error: () => { } });
  }

  // ── Local stat mutations ───────────────────────────────────
  private applyMatchLocally(p: HistoryMatch): void {
    if (!this.me || !this.friend) return;
    const myG = p.me_normalGoals + p.me_penaltyGoals + p.me_freekickGoals + p.me_cornerGoals + p.friend_ownGoals;
    const frG = p.friend_normalGoals + p.friend_penaltyGoals + p.friend_freekickGoals + p.friend_cornerGoals + p.me_ownGoals;

    this.me.stats.totalMatches++;
    this.me.stats.totalGoals += myG;
    this.me.stats.penaltyGoals += p.me_penaltyGoals;
    this.me.stats.freekickGoals += p.me_freekickGoals;
    this.me.stats.cornerGoals += p.me_cornerGoals;
    this.me.stats.ownGoals += p.me_ownGoals;
    if (p.result === 'win') this.me.stats.wins++;
    if (p.result === 'draw') this.me.stats.draws++;
    if (p.result === 'loss') this.me.stats.losses++;
    if (frG > 0) this.me.concededMatches++;

    this.friend.stats.totalMatches++;
    this.friend.stats.totalGoals += frG;
    this.friend.stats.penaltyGoals += p.friend_penaltyGoals;
    this.friend.stats.freekickGoals += p.friend_freekickGoals;
    this.friend.stats.cornerGoals += p.friend_cornerGoals;
    this.friend.stats.ownGoals += p.friend_ownGoals;
    if (p.result === 'loss') this.friend.stats.wins++;
    if (p.result === 'draw') this.friend.stats.draws++;
    if (p.result === 'win') this.friend.stats.losses++;
    if (myG > 0) this.friend.concededMatches++;
  }

  private reverseMatchLocally(p: HistoryMatch): void {
    if (!this.me || !this.friend) return;
    const myG = p.me_normalGoals + p.me_penaltyGoals + p.me_freekickGoals + p.me_cornerGoals + p.friend_ownGoals;
    const frG = p.friend_normalGoals + p.friend_penaltyGoals + p.friend_freekickGoals + p.friend_cornerGoals + p.me_ownGoals;
    const dec = (n: number) => Math.max(0, n - 1);

    this.me.stats.totalMatches = dec(this.me.stats.totalMatches);
    this.me.stats.totalGoals = Math.max(0, this.me.stats.totalGoals - myG);
    this.me.stats.penaltyGoals = Math.max(0, this.me.stats.penaltyGoals - p.me_penaltyGoals);
    this.me.stats.freekickGoals = Math.max(0, this.me.stats.freekickGoals - p.me_freekickGoals);
    this.me.stats.cornerGoals = Math.max(0, this.me.stats.cornerGoals - p.me_cornerGoals);
    this.me.stats.ownGoals = Math.max(0, this.me.stats.ownGoals - p.me_ownGoals);
    if (p.result === 'win') this.me.stats.wins = dec(this.me.stats.wins);
    if (p.result === 'draw') this.me.stats.draws = dec(this.me.stats.draws);
    if (p.result === 'loss') this.me.stats.losses = dec(this.me.stats.losses);
    if (frG > 0) this.me.concededMatches = dec(this.me.concededMatches);

    this.friend.stats.totalMatches = dec(this.friend.stats.totalMatches);
    this.friend.stats.totalGoals = Math.max(0, this.friend.stats.totalGoals - frG);
    this.friend.stats.penaltyGoals = Math.max(0, this.friend.stats.penaltyGoals - p.friend_penaltyGoals);
    this.friend.stats.freekickGoals = Math.max(0, this.friend.stats.freekickGoals - p.friend_freekickGoals);
    this.friend.stats.cornerGoals = Math.max(0, this.friend.stats.cornerGoals - p.friend_cornerGoals);
    this.friend.stats.ownGoals = Math.max(0, this.friend.stats.ownGoals - p.friend_ownGoals);
    if (p.result === 'loss') this.friend.stats.wins = dec(this.friend.stats.wins);
    if (p.result === 'draw') this.friend.stats.draws = dec(this.friend.stats.draws);
    if (p.result === 'win') this.friend.stats.losses = dec(this.friend.stats.losses);
    if (myG > 0) this.friend.concededMatches = dec(this.friend.concededMatches);
  }

  private freshMatch(): MatchForm {
    return { me_n: 0, me_p: 0, me_f: 0, me_c: 0, me_og: 0, fr_n: 0, fr_p: 0, fr_f: 0, fr_c: 0, fr_og: 0 };
  }

  private showToast(msg: string): void {
    this.toastMessage = msg; this.toastVisible = true;
    setTimeout(() => this.toastVisible = false, 3200);
  }
}