import { ref, Ref, markRaw } from 'vue';
import * as tf from '@tensorflow/tfjs';
import { Tensor, tensor2d, zeros } from '@tensorflow/tfjs';
import { ConfigService } from './ConfigService';
import { GameService } from './GameService';
import { Memory } from '../Memory';
import { Model } from '../Model';

// Web worker for AI training
let trainingWorker: Worker | null = null;

export class AITrainingService {
  private model: Ref<Model | null> = ref(null);
  private memory: Ref<Memory>;
  private steps: Ref<number>;
  private trainingRounds: Ref<number>;
  private trainingDelay: Ref<number>;
  private noDelay: Ref<boolean>;
  private status: Ref<string> = ref('idle');
  private blockInput: Ref<boolean> = ref(false);
  private configService: ConfigService;
  private gameService: GameService;

  constructor(configService: ConfigService, gameService: GameService) {
    this.configService = configService;
    this.gameService = gameService;
    this.steps = ref(this.configService.getAIConfig().steps);
    this.trainingRounds = ref(this.configService.getAIConfig().trainingRounds);
    this.memory = ref(markRaw(new Memory(this.configService.getAIConfig().memorySlots)));
    this.trainingDelay = ref(this.configService.getUIConfig().trainingDelay);
    this.noDelay = ref(this.configService.getUIConfig().noDelay);

    // Set up watchers to update the ConfigService when values change
    this.setupWatchers();
  }

  private setupWatchers(): void {
    // These watchers would normally be in a Vue component
    // For a service, we'd need to use a different approach or handle this in the component
  }

  public getModel(): Ref<Model | null> {
    return this.model;
  }

  public setModel(model: Model): void {
    this.model.value = model;
  }

  public getMemory(): Ref<Memory> {
    return this.memory;
  }

  public getSteps(): Ref<number> {
    return this.steps;
  }

  public setSteps(steps: number): void {
    this.steps.value = steps;
    this.configService.updateAIConfig({ steps });
  }

  public getTrainingRounds(): Ref<number> {
    return this.trainingRounds;
  }

  public setTrainingRounds(rounds: number): void {
    this.trainingRounds.value = rounds;
    this.configService.updateAIConfig({ trainingRounds: rounds });
  }

  public getTrainingDelay(): Ref<number> {
    return this.trainingDelay;
  }

  public setTrainingDelay(delay: number): void {
    this.trainingDelay.value = delay;
    this.configService.updateUIConfig({ trainingDelay: delay });
  }

  public getNoDelay(): Ref<boolean> {
    return this.noDelay;
  }

  public setNoDelay(noDelay: boolean): void {
    this.noDelay.value = noDelay;
    this.configService.updateUIConfig({ noDelay });
  }

  public getStatus(): Ref<string> {
    return this.status;
  }

  public getBlockInput(): Ref<boolean> {
    return this.blockInput;
  }

  private sleep(time: number): Promise<void> {
    return new Promise<void>((resolve) => {
      setTimeout(() => resolve(), time);
    });
  }

  public async play(): Promise<void> {
    if (!this.model.value) {
      console.error("No model!");
      return;
    }

    this.status.value = "Playing";
    this.blockInput.value = true;
    let neededSteps = 0;

    while (true) {
      const [lost, won] = await this.playOneStep();
      neededSteps++;

      if (lost || won) {
        break;
      }

      await this.sleep(this.trainingDelay.value);
    }

    this.status.value = "idle";
    this.blockInput.value = false;
    console.log("Steps performed:", neededSteps);
  }

  private async playOneStep(): Promise<[boolean, boolean]> {
    if (!this.model.value) {
      return [false, false];
    }

    const state = this.gameService.getState().value;
    const stateTensor: Tensor = tensor2d([state]);
    const action = this.model.value.chooseAction(stateTensor);
    const ret = this.gameService.shift(this.actionToDirection(action[0]));

    if (!ret) {
      await this.sleep(50);
    }

    return [this.gameService.isLost().value, this.gameService.isWon().value];
  }

  private actionToDirection(action: number): "left" | "right" | "up" | "down" {
    switch (action) {
      case 0:
        return "up";
      case 1:
        return "down";
      case 2:
        return "right";
      case 3:
        return "left";
      default:
        return "up"; // Default to up if invalid action
    }
  }

  public async train(): Promise<void> {
    if (!this.model.value) {
      console.error("No model");
      return;
    }

    this.gameService.reset();
    this.blockInput.value = true;
    this.status.value = "Preparing training...";

    try {
      // Create a new web worker if it doesn't exist
      if (!trainingWorker) {
        trainingWorker = new Worker(new URL('../workers/AITrainingWorker.ts', import.meta.url), { type: 'module' });
      }

      // Set up event listeners for the worker
      trainingWorker.onmessage = this.handleWorkerMessage.bind(this);
      trainingWorker.onerror = this.handleWorkerError.bind(this);

      // Save the model to get its artifacts
      const modelArtifacts = await this.model.value.network.save(
        tf.io.withSaveHandler(async (artifacts) => {
          return artifacts;
        })
      );

      // Start the training in the worker
      trainingWorker.postMessage({
        type: 'train',
        model: modelArtifacts,
        memoryData: [], // We don't transfer memory data yet as it's complex with tensors
        trainingRounds: this.trainingRounds.value,
        steps: this.steps.value,
        discountRate: this.configService.getAIConfig().discountRate,
        tableSize: this.gameService.getTableSize().value
      });

      // For now, we'll still use the existing training method
      // This will be removed once the worker implementation is complete
      this.status.value = "Training in worker...";

      // The rest of the process is handled by the worker and event handlers
    } catch (error) {
      console.error("Error starting training worker:", error);
      this.status.value = "Training error";
      this.blockInput.value = false;

      // Fall back to the old method if the worker fails
      await this.trainInMainThread();
    }
  }

  private async trainInMainThread(): Promise<void> {
    if (!this.model.value) {
      return;
    }

    this.status.value = "Training in main thread (fallback)";

    for (let i = 0; i < this.trainingRounds.value; i++) {
      this.status.value = `Training round ${i + 1}`;
      console.log(`Training round ${i + 1}`);
      await this.runTrainingEpisode();

      if (!this.noDelay.value) {
        await this.sleep(100);
      }
    }

    this.blockInput.value = false;
    this.status.value = "idle";
  }

  private handleWorkerMessage(event: MessageEvent): void {
    const data = event.data;

    switch (data.type) {
      case 'trainingProgress':
        this.status.value = `Training round ${data.round}/${data.totalRounds}`;
        if (data.reward > 0) {
          console.log("Achieved reward:", data.reward);
        }
        break;

      case 'trainingComplete':
        // Load the updated model from the worker
        tf.loadLayersModel(tf.io.fromMemory(data.model))
          .then((model) => {
            if (this.model.value) {
              this.model.value.network = model as tf.Sequential;
              console.log("Model updated from worker");
            }
            this.status.value = "idle";
            this.blockInput.value = false;
          })
          .catch((error) => {
            console.error("Error loading model from worker:", error);
            this.status.value = "Error loading model";
            this.blockInput.value = false;
          });
        break;

      case 'error':
        console.error("Worker error:", data.error);
        this.status.value = "Training error";
        this.blockInput.value = false;
        break;
    }
  }

  private handleWorkerError(error: ErrorEvent): void {
    console.error("Worker error:", error);
    this.status.value = "Worker error";
    this.blockInput.value = false;
  }

  private async runTrainingEpisode(): Promise<void> {
    if (!this.model.value) {
      return;
    }

    let state: Tensor = tensor2d([this.gameService.getState().value]);
    let totalReward = 0;
    let step = 0;

    while (step < this.steps.value) {
      // Interaction with the environment
      const action = this.model.value.chooseAction(state);
      this.gameService.shift(this.actionToDirection(action[0]));

      const done = this.gameService.isWon().value || this.gameService.isLost().value;
      const reward = this.computeReward(
        this.gameService.getState().value,
        this.gameService.getCurrentScore().value,
        this.gameService.isLost().value
      );

      let nextState: Tensor = tensor2d([this.gameService.getState().value]);

      if (done) {
        this.memory.value.addSample([state, action, reward, null]);
      } else {
        this.memory.value.addSample([state, action, reward, nextState]);
      }

      state = nextState;
      totalReward += reward;
      step += 1;

      // Keep track of the max position reached and store the total reward
      if (step === this.steps.value) {
        console.log("Achieved reward: " + totalReward);
        break;
      }

      if (done) {
        this.gameService.reset();
      }

      if (!this.noDelay.value) {
        await this.sleep(this.trainingDelay.value);
      }
    }

    await this.replay();
    this.gameService.reset();
  }

  private computeReward(position: number[], currentScore: number, lost: boolean): number {
    let reward = 0;
    let maxValue = position.reduce((previousValue, currentValue) => {
      return previousValue < currentValue ? currentValue : previousValue;
    });

    if (maxValue <= 64) {
      reward = 5;
    } else if (maxValue === 128) {
      reward = 20;
    } else if (maxValue === 256) {
      reward = 40;
    } else if (maxValue === 512) {
      reward = 60;
    } else if (maxValue === 1024) {
      reward = 80;
    } else if (maxValue === 2048) {
      reward = 100;
    }

    if (currentScore < 100) {
      reward -= 10;
    } else if (currentScore < 200) {
      reward += 10;
    } else if (currentScore < 300) {
      reward += 20;
    } else if (currentScore >= 300) {
      reward += 40;
    }

    if (lost) {
      reward -= 50;
    }

    return reward;
  }

  private async replay(): Promise<void> {
    if (!this.model.value) {
      return;
    }

    // Sample from memory
    const batch = this.memory.value.sample(this.model.value.batchSize);
    const states = batch.map(([state, , ,]) => state);
    const nextStates = batch.map(
      ([, , , nextState]) => nextState ? nextState : zeros([this.model.value!.numStates])
    );

    // Predict the values of each action at each state
    const qsa = states.map((state) => this.model.value!.predict(state));
    // Predict the values of each action at each next state
    const qsad = nextStates.map((nextState) => this.model.value!.predict(nextState));

    let x: any[] | Tensor = [];
    let y: any[] | Tensor = [];

    // Update the states rewards with the discounted next states rewards
    batch.forEach(
      ([state, action, reward, nextState], index) => {
        const currentQ: any = qsa[index];
        const discountRate = configService.getAIConfig().discountRate;
        //@ts-ignore
        currentQ[action] = nextState ? reward + discountRate * qsad[index].max().dataSync() : reward;
        //@ts-ignore
        x.push(state.dataSync());
        //@ts-ignore
        y.push(currentQ.dataSync());
      }
    );

    // Clean unused tensors
    //@ts-ignore
    qsa.forEach((state) => state.dispose());
    //@ts-ignore
    qsad.forEach((state) => state.dispose());

    // Reshape the batches to be fed to the network
    x = tensor2d(x, [x.length, this.model.value.numStates]);
    y = tensor2d(y, [y.length, this.model.value.numActions]);

    // Learn the Q(s, a) values given associated discounted rewards
    await this.model.value.train(x, y);

    x.dispose();
    y.dispose();
  }
}

// The service will be instantiated by the ServiceContainer
