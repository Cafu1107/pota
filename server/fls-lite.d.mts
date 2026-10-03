export interface FlsLiteTeam {
  name: string;
  score: number;
  periods: number[];
}

export interface FlsLite {
  started: boolean;
  ended: boolean;
  isBreak: boolean;
  period: number;
  periodType: string;
  periodsMax: number;
  clock: string;
  tm: { 1: FlsLiteTeam; 2: FlsLiteTeam };
}

export function flsLite(j: unknown): FlsLite;
