export type Difficulty = 'easy' | 'normal' | 'hard';

export interface DifficultySettings {
  escapeDistance: number;
  moveDistance: number;
  escapeDelay: number;
  label: string;
  scoreValue: number;
  background: string;
  accent: string;
  confettiCount: number;
}

export const DIFFICULTY_SETTINGS: Record<Difficulty, DifficultySettings> = {
  easy: {
    escapeDistance: 30,
    moveDistance: 50,
    escapeDelay: 1400,
    label: 'Easy',
    scoreValue: 1,
    background: 'from-green-400 to-blue-500',
    accent: 'from-yellow-400 to-orange-500',
    confettiCount: 300
  },
  normal: {
    escapeDistance: 40,
    moveDistance: 70,
    escapeDelay: 900,
    label: 'Normal',
    scoreValue: 3,
    background: 'from-blue-400 to-purple-600',
    accent: 'from-yellow-400 to-orange-500',
    confettiCount: 500
  },
  hard: {
    escapeDistance: 55,
    moveDistance: 110,
    escapeDelay: 450,
    label: 'Hard',
    scoreValue: 5,
    background: 'from-purple-500 to-red-600',
    accent: 'from-yellow-400 to-orange-500',
    confettiCount: 800
  }
};