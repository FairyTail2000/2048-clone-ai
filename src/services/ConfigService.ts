import { reactive, watch } from 'vue';

// Define interfaces for different configuration categories
export interface GameConfig {
  tableSize: number;
  tileSize: number;
}

export interface AIConfig {
  memorySlots: number;
  steps: number;
  trainingRounds: number;
  discountRate: number;
}

export interface UIConfig {
  noDelay: boolean;
  trainingDelay: number;
}

export interface AppConfig {
  game: GameConfig;
  ai: AIConfig;
  ui: UIConfig;
}

// Default configuration values
const DEFAULT_CONFIG: AppConfig = {
  game: {
    tableSize: 4,
    tileSize: 4
  },
  ai: {
    memorySlots: 1000,
    steps: 50,
    trainingRounds: 10,
    discountRate: 0.95
  },
  ui: {
    noDelay: false,
    trainingDelay: 50
  }
};

export class ConfigService {
  private config: AppConfig;

  constructor() {
    // Initialize with default values
    this.config = reactive({ ...DEFAULT_CONFIG });

    // Load saved configuration from localStorage if available
    this.loadConfig();

    // Set up watcher to save changes to localStorage
    watch(() => this.config, () => {
      this.saveConfig();
    }, { deep: true });
  }

  // Get the entire configuration
  public getConfig(): AppConfig {
    return this.config;
  }

  // Get game configuration
  public getGameConfig(): GameConfig {
    return this.config.game;
  }

  // Get AI configuration
  public getAIConfig(): AIConfig {
    return this.config.ai;
  }

  // Get UI configuration
  public getUIConfig(): UIConfig {
    return this.config.ui;
  }

  // Update the entire configuration
  public updateConfig(newConfig: Partial<AppConfig>): void {
    if (newConfig.game) {
      Object.assign(this.config.game, newConfig.game);
    }
    if (newConfig.ai) {
      Object.assign(this.config.ai, newConfig.ai);
    }
    if (newConfig.ui) {
      Object.assign(this.config.ui, newConfig.ui);
    }
  }

  // Update game configuration
  public updateGameConfig(gameConfig: Partial<GameConfig>): void {
    Object.assign(this.config.game, gameConfig);
  }

  // Update AI configuration
  public updateAIConfig(aiConfig: Partial<AIConfig>): void {
    Object.assign(this.config.ai, aiConfig);
  }

  // Update UI configuration
  public updateUIConfig(uiConfig: Partial<UIConfig>): void {
    Object.assign(this.config.ui, uiConfig);
  }

  // Reset configuration to defaults
  public resetConfig(): void {
    Object.assign(this.config, DEFAULT_CONFIG);
  }

  // Load configuration from localStorage
  private loadConfig(): void {
    const savedConfig = localStorage.getItem('appConfig');
    if (savedConfig) {
      try {
        const parsedConfig = JSON.parse(savedConfig);
        this.updateConfig(parsedConfig);
      } catch (error) {
        console.error('Failed to parse saved configuration:', error);
      }
    }
  }

  // Save configuration to localStorage
  private saveConfig(): void {
    localStorage.setItem('appConfig', JSON.stringify(this.config));
  }
}

// The service will be instantiated by the ServiceContainer
