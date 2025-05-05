import { reactive } from 'vue';
import { ConfigService } from './ConfigService';
import { GameService } from './GameService';
import { AITrainingService } from './AITrainingService';
import { ModelService } from './ModelService';

// Interface for the service container
export interface ServiceContainer {
  configService: ConfigService;
  gameService: GameService;
  aiTrainingService: AITrainingService;
  modelService: ModelService;
}

// Create a reactive service container
const container = reactive<ServiceContainer>({} as ServiceContainer);

// Initialize the container with services
export function initializeServices(): void {
  // Create services in the correct order based on dependencies
  container.configService = new ConfigService();
  container.gameService = new GameService(container.configService);
  container.aiTrainingService = new AITrainingService(container.configService, container.gameService);
  container.modelService = new ModelService(container.aiTrainingService);
}

// Get the service container
export function getServiceContainer(): ServiceContainer {
  return container;
}

// Helper functions to get individual services
export function getConfigService(): ConfigService {
  return container.configService;
}

export function getGameService(): GameService {
  return container.gameService;
}

export function getAITrainingService(): AITrainingService {
  return container.aiTrainingService;
}

export function getModelService(): ModelService {
  return container.modelService;
}