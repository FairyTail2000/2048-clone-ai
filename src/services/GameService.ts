import { ref, Ref } from 'vue';
import configService from './ConfigService';

export interface GameState {
  state: number[];
  currentScore: number;
  won: boolean;
  lost: boolean;
}

export class GameService {
  private state: Ref<number[]>;
  private currentScore: Ref<number> = ref(0);
  private maxScore: Ref<number> = ref(0);
  private won: Ref<boolean> = ref(false);
  private lost: Ref<boolean> = ref(false);
  private tableSize: Ref<number>;

  constructor() {
    this.tableSize = ref(configService.getGameConfig().tableSize);
    this.state = ref(new Array(this.tableSize.value * this.tableSize.value).fill(0));
    this.reset();
  }

  public getState(): Ref<number[]> {
    return this.state;
  }

  public getCurrentScore(): Ref<number> {
    return this.currentScore;
  }

  public getMaxScore(): Ref<number> {
    return this.maxScore;
  }

  public isWon(): Ref<boolean> {
    return this.won;
  }

  public isLost(): Ref<boolean> {
    return this.lost;
  }

  public getTableSize(): Ref<number> {
    return this.tableSize;
  }

  public setTableSize(size: number): void {
    this.tableSize.value = size;
    configService.updateGameConfig({ tableSize: size });
    this.reset();
  }

  public reset(): void {
    this.currentScore.value = 0;
    this.state.value = new Array(this.tableSize.value * this.tableSize.value).fill(0);
    this.won.value = false;
    this.lost.value = false;
    this.generateTile();
  }

  public shift(direction: "left" | "right" | "up" | "down"): boolean {
    if (this.lost.value || this.won.value) {
      return false;
    }

    switch (direction) {
      case "left":
        this.shiftLeft();
        break;
      case "right":
        this.shiftRight();
        break;
      case "up":
        this.shiftUp();
        break;
      case "down":
        this.shiftDown();
        break;
    }

    this.generateTile();
    return true;
  }

  private shiftLeft(): void {
    for (let i = 0; i < this.state.value.length / this.tableSize.value; i++) {
      for (let j = (this.state.value.length / this.tableSize.value) * i + 1; j < (this.state.value.length / this.tableSize.value) * (i + 1); j++) {
        if (this.state.value[j] !== 0 && (this.state.value[j] === this.state.value[j - 1] || this.state.value[j - 1] === 0)) {
          if (this.state.value[j] === this.state.value[j - 1]) {
            this.updateScore(this.state.value[j] * 2);
          }
          this.state.value[j - 1] += this.state.value[j];
          this.state.value[j] = 0;
          if (this.state.value[j - 1] === 2048) {
            this.won.value = true;
          }
        }
      }
    }
  }

  private shiftRight(): void {
    for (let i = this.state.value.length / this.tableSize.value; i > 0; i--) {
      for (let j = ((this.tableSize.value * (i - 1)) + this.tableSize.value) - 1; j > ((i - 1) * this.tableSize.value); j--) {
        if (this.state.value[j - 1] !== 0 && (this.state.value[j] === this.state.value[j - 1] || this.state.value[j] === 0)) {
          if (this.state.value[j] === this.state.value[j - 1]) {
            this.updateScore(this.state.value[j] * 2);
          }
          this.state.value[j] += this.state.value[j - 1];
          this.state.value[j - 1] = 0;
          if (this.state.value[j] === 2048) {
            this.won.value = true;
          }
        }
      }
    }
  }

  private shiftUp(): void {
    for (let i = 1; i < this.state.value.length / this.tableSize.value; i++) {
      for (let j = i * this.tableSize.value; j < (i * this.tableSize.value) + this.tableSize.value; j++) {
        if (this.state.value[j] !== 0 && (this.state.value[j] === this.state.value[j - this.tableSize.value] || this.state.value[j - this.tableSize.value] === 0)) {
          if (this.state.value[j] === this.state.value[j - this.tableSize.value]) {
            this.updateScore(this.state.value[j] * 2);
          }
          this.state.value[j - this.tableSize.value] += this.state.value[j];
          this.state.value[j] = 0;
          if (this.state.value[j - this.tableSize.value] === 2048) {
            this.won.value = true;
          }
        }
      }
    }
  }

  private shiftDown(): void {
    for (let i = this.state.value.length / this.tableSize.value - 1; i >= 0; i--) {
      for (let j = i * this.tableSize.value; j < (i * this.tableSize.value) + this.tableSize.value; j++) {
        if (this.state.value[j] !== 0 && (this.state.value[j] === this.state.value[j + this.tableSize.value] || this.state.value[j + this.tableSize.value] === 0)) {
          if (this.state.value[j] === this.state.value[j + this.tableSize.value]) {
            this.updateScore(this.state.value[j] * 2);
          }
          this.state.value[j + this.tableSize.value] += this.state.value[j];
          this.state.value[j] = 0;
          if (this.state.value[j + this.tableSize.value] === 2048) {
            this.won.value = true;
          }
        }
      }
    }
  }

  private updateScore(points: number): void {
    this.currentScore.value += points;
    if (this.currentScore.value > this.maxScore.value) {
      this.maxScore.value = this.currentScore.value;
    }
  }

  private generateTile(): void {
    if (this.lost.value || this.won.value) {
      return;
    }

    let emptyIndexes = [];
    for (let i = 0; i < this.state.value.length; i++) {
      if (this.state.value[i] === 0) {
        emptyIndexes.push(i);
      }
    }

    if (emptyIndexes.length === 0) {
      this.lost.value = true;
    } else {
      this.state.value[emptyIndexes[Math.floor(Math.random() * emptyIndexes.length)]] = 2;
    }
  }

  // Helper function to partition the state array for rendering
  public partition(size?: number): number[][] {
    const partitionSize = size || this.tableSize.value;
    const p = [];
    for (let i = Math.floor(this.state.value.length / partitionSize); i-- > 0;) {
      p[i] = this.state.value.slice(i * partitionSize, (i + 1) * partitionSize);
    }
    return p;
  }
}

// Create a singleton instance
const gameService = new GameService();
export default gameService;
