// models/player.model.ts

export interface PlayerStats {
  totalMatches: number;
  totalGoals: number;
  wins: number;
  draws: number;
  losses: number;
  penaltyGoals: number;
  freekickGoals: number;
  cornerGoals: number;
  ownGoals: number; // own goals I scored INTO my own net
}

export interface Player {
  _id?: string;
  name: string;
  stats: PlayerStats;
  concededMatches: number; // matches where goals were conceded
  createdAt?: string;
  updatedAt?: string;
}

// What gets sent when adding a match result
export interface MatchEntry {
  matchDate: string;         // ISO date string
  result: 'win' | 'draw' | 'loss'; // from Shakthi's perspective

  // Shakthi's goals breakdown
  me_normalGoals: number;
  me_penaltyGoals: number;
  me_freekickGoals: number;
  me_cornerGoals: number;
  me_ownGoals: number;       // own goals scored by Shakthi (benefit Shynu)

  // Shynu's goals breakdown
  friend_normalGoals: number;
  friend_penaltyGoals: number;
  friend_freekickGoals: number;
  friend_cornerGoals: number;
  friend_ownGoals: number;   // own goals scored by Shynu (benefit Shakthi)
}

export interface MatchResult {
  // Computed totals from MatchEntry
  me_totalGoals: number;     // me_normalGoals + me_penaltyGoals + me_freekickGoals + me_cornerGoals
  friend_totalGoals: number;
}