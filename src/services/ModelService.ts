import { ref, Ref, markRaw, toRaw } from 'vue';
import { io, loadLayersModel, LayersModel } from '@tensorflow/tfjs';
import { Model } from '../Model';
import { AITrainingService } from './AITrainingService';

export class ModelService {
  private models: Ref<Record<string, LayersModel>> = ref({});
  private currentlySelectedModel: Ref<string> = ref('');
  private readonly MODEL_SAVE_PATH = 'indexeddb://game-model-';
  private readonly NUMBER_OF_STATES = 36;
  private readonly NUMBER_OF_ACTIONS = 4;
  private readonly BATCH_SIZE = 1;
  private aiTrainingService: AITrainingService;

  constructor(aiTrainingService: AITrainingService) {
    this.aiTrainingService = aiTrainingService;
    // Load available models on initialization
    void this.loadAvailableModels();
  }

  private async loadAvailableModels(): Promise<void> {
    try {
      this.models.value = await io.listModels();
    } catch (error) {
      console.error('Failed to load available models:', error);
      this.models.value = {};
    }
  }

  public getModels(): Ref<Record<string, LayersModel>> {
    return this.models;
  }

  public getCurrentlySelectedModel(): Ref<string> {
    return this.currentlySelectedModel;
  }

  public setCurrentlySelectedModel(modelPath: string): void {
    this.currentlySelectedModel.value = modelPath;
  }

  public async createNewModel(): Promise<void> {
    const model = new Model(this.NUMBER_OF_STATES, this.NUMBER_OF_ACTIONS, this.BATCH_SIZE);
    this.aiTrainingService.setModel(markRaw(model));
  }

  public async loadModel(modelPath: string = ''): Promise<void> {
    const path = modelPath || this.currentlySelectedModel.value;

    if (!path) {
      console.error('No model path provided');
      return;
    }

    try {
      const loadedModel = await loadLayersModel(path);
      const model = new Model(
        this.NUMBER_OF_STATES,
        this.NUMBER_OF_ACTIONS,
        this.BATCH_SIZE,
        loadedModel
      );
      this.aiTrainingService.setModel(markRaw(model));
    } catch (error) {
      console.error(`Failed to load model from ${path}:`, error);
    }
  }

  public async saveModel(): Promise<void> {
    const model = this.aiTrainingService.getModel().value;

    if (!model) {
      console.error('No model to save');
      return;
    }

    try {
      // Get the count of existing models to generate a new name
      const models = await io.listModels();
      let count = Object.keys(models).length;

      // Save the model with a new name
      const savePath = `${this.MODEL_SAVE_PATH}${count}`;
      await toRaw(model).saveModel(savePath);

      // Refresh the list of available models
      await this.loadAvailableModels();

      console.log(`Model saved as ${savePath}`);
    } catch (error) {
      console.error('Failed to save model:', error);
    }
  }

  public async overwriteModel(modelPath: string = ''): Promise<void> {
    const path = modelPath || this.currentlySelectedModel.value;
    const model = this.aiTrainingService.getModel().value;

    if (!path) {
      console.error('No model path provided');
      return;
    }

    if (!model) {
      console.error('No model to save');
      return;
    }

    try {
      await toRaw(model).saveModel(path);

      // Refresh the list of available models
      await this.loadAvailableModels();

      console.log(`Model overwritten at ${path}`);
    } catch (error) {
      console.error(`Failed to overwrite model at ${path}:`, error);
    }
  }

  public async deleteModel(modelPath: string = ''): Promise<void> {
    const path = modelPath || this.currentlySelectedModel.value;

    if (!path) {
      console.error('No model path provided');
      return;
    }

    try {
      await io.removeModel(path);

      // Refresh the list of available models
      await this.loadAvailableModels();

      // Clear the currently selected model if it was deleted
      if (this.currentlySelectedModel.value === path) {
        this.currentlySelectedModel.value = '';
      }

      console.log(`Model deleted: ${path}`);
    } catch (error) {
      console.error(`Failed to delete model at ${path}:`, error);
    }
  }
}

// The service will be instantiated by the ServiceContainer
