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
    CommonModule,
    FormsModule,
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

  // E-Code gate — covers add, edit AND delete
  showECodePrompt = false;
  eCodeInput = '';
  eCodeError = '';
  private pendingModalAction: 'add' | 'edit' | 'delete' | null = null;
  private pendingEditIndex: number | null = null;
  private pendingDeleteIndex: number | null = null;

  // Delete confirm (shown AFTER e-code passes)
  showDeleteConfirm = false;

  toastMessage = '';
  toastVisible = false;

  private API = 'https://erp-backend-sable-eta.vercel.app/api';
  private sub!: Subscription;
  private players$ = new BehaviorSubject<Player[]>([]);
  private isBrowser: boolean;

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
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) platformId: object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    this.sub = this.players$.subscribe(players => {
      this.me = players.find(p => p.name === 'Shakthi') ?? null;
      this.friend = players.find(p => p.name === 'Shynu') ?? null;
      queueMicrotask(() => this.cdr.detectChanges());
    });
    this.loadPlayers();
    if (this.isBrowser) {
      this.loadPhotos();
      this.loadHistory();
    }
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  // ── HTTP ──────────────────────────────────────────────────
  private loadPlayers(): void {
    this.http.get<Player[]>(`${this.API}/players`).pipe(
      tap(p => {
        console.log('Players API Response:', p);
        this.players$.next(p);
      })
    ).subscribe({
      error: (err) => {
        console.error('API Error:', err);
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

  // ── NEW: Reverse a match in the DB (for edit & delete) ────
  private reverseMatchInDB(match: HistoryMatch) {
    return this.http.post<{ me: Player; friend: Player }>(`${this.API}/matches/reverse`, match);
  }

  // ── localStorage helpers ──────────────────────────────────
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

  // ── E-Code gate (add / edit / delete all go through here) ─
  openModal(): void {
    this.pendingModalAction = 'add';
    this.pendingEditIndex = null;
    this.pendingDeleteIndex = null;
    this.eCodeInput = '';
    this.eCodeError = '';
    this.showECodePrompt = true;
  }

  openEditMatch(index: number): void {
    this.pendingModalAction = 'edit';
    this.pendingEditIndex = index;
    this.pendingDeleteIndex = null;
    this.eCodeInput = '';
    this.eCodeError = '';
    this.showECodePrompt = true;
  }

  confirmDeleteMatch(index: number): void {
    this.pendingModalAction = 'delete';
    this.pendingDeleteIndex = index;
    this.pendingEditIndex = null;
    this.eCodeInput = '';
    this.eCodeError = '';
    this.showECodePrompt = true;
  }

  submitECode(): void {
    if (this.eCodeInput.trim().toUpperCase() !== 'FREE') {
      this.eCodeError = 'Invalid E-Code. Please try again.';
      return;
    }

    this.showECodePrompt = false;
    this.eCodeError = '';

    if (this.pendingModalAction === 'add') {
      this.editIndex = null;
      this.match = this.freshMatch();
      this.currentResult = null;
      const now = new Date();
      this.matchDate = now.toISOString().slice(0, 10);
      this.matchTime = now.toTimeString().slice(0, 5);
      this.showModal = true;

    } else if (this.pendingModalAction === 'edit' && this.pendingEditIndex !== null) {
      const m = this.matchHistory[this.pendingEditIndex];
      this.editIndex = this.pendingEditIndex;
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

    } else if (this.pendingModalAction === 'delete' && this.pendingDeleteIndex !== null) {
      // E-code passed → show the delete confirmation dialog
      this.showDeleteConfirm = true;
    }
  }

  cancelECode(): void {
    this.showECodePrompt = false;
    this.eCodeInput = '';
    this.eCodeError = '';
    this.pendingModalAction = null;
    this.pendingEditIndex = null;
    this.pendingDeleteIndex = null;
  }

  // ── Delete confirm ────────────────────────────────────────
  cancelDelete(): void {
    this.showDeleteConfirm = false;
    this.pendingDeleteIndex = null;
    this.pendingModalAction = null;
  }

  // ── FIXED: Delete now calls the DB reverse endpoint ───────
  executeDelete(): void {
    if (this.pendingDeleteIndex === null) return;
    const m = this.matchHistory[this.pendingDeleteIndex];
    const indexToDelete = this.pendingDeleteIndex;

    this.reverseMatchInDB(m).subscribe({
      next: (res) => {
        // Update players from the real DB response
        this.players$.next([res.me, res.friend]);
        this.matchHistory.splice(indexToDelete, 1);
        this.saveHistory();
        this.showDeleteConfirm = false;
        this.pendingDeleteIndex = null;
        this.pendingModalAction = null;
        this.showToast('🗑️ Match deleted!');
      },
      error: (err) => {
        console.error('Delete failed:', err);
        this.showToast('❌ Failed to delete. Please try again.');
      }
    });
  }

  // ── Modal ─────────────────────────────────────────────────
  closeModal(): void { this.showModal = false; this.editIndex = null; }

  onOverlayClick(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('overlay')) this.closeModal();
  }

  setResult(r: 'win' | 'draw' | 'loss'): void { this.currentResult = r; }

  change(key: string, delta: number): void {
    this.match[key] = Math.max(0, (this.match[key] || 0) + delta);
  }

  // ── FIXED: submitMatch now uses DB responses for state ────
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
      // Edit: reverse the old match in DB, then post the new one
      const oldMatch = this.matchHistory[this.editIndex];
      const editIdx = this.editIndex;

      this.reverseMatchInDB(oldMatch).subscribe({
        next: () => {
          this.postMatch(payload).subscribe({
            next: (res) => {
              // Update players from real DB response
              this.players$.next([res.me, res.friend]);
              this.matchHistory[editIdx] = payload;
              this.saveHistory();
              this.submitLoading = false;
              this.showModal = false;
              this.editIndex = null;
              this.showToast('✓ Match updated!');
            },
            error: (err) => {
              console.error('Post match failed during edit:', err);
              // Attempt to re-apply the old match to keep DB consistent
              this.postMatch(oldMatch).subscribe();
              this.submitLoading = false;
              this.showToast('❌ Update failed. Changes rolled back.');
            }
          });
        },
        error: (err) => {
          console.error('Reverse failed during edit:', err);
          this.submitLoading = false;
          this.showToast('❌ Update failed. Please try again.');
        }
      });

    } else {
      // New match: post and use DB response to update state
      this.postMatch(payload).subscribe({
        next: (res) => {
          // Update players from real DB response — no more local mutation!
          this.players$.next([res.me, res.friend]);
          this.matchHistory.unshift(payload);
          this.saveHistory();
          this.submitLoading = false;
          this.showModal = false;
          this.showToast('⚽ Match added!');
        },
        error: (err) => {
          console.error('Post match failed:', err);
          this.submitLoading = false;
          this.showToast('❌ Failed to save match. Please try again.');
        }
      });
    }
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

  private freshMatch(): MatchForm {
    return { me_n: 0, me_p: 0, me_f: 0, me_c: 0, me_og: 0, fr_n: 0, fr_p: 0, fr_f: 0, fr_c: 0, fr_og: 0 };
  }

  private showToast(msg: string): void {
    this.toastMessage = msg; this.toastVisible = true;
    setTimeout(() => this.toastVisible = false, 3200);
  }
}