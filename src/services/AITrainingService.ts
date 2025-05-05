import { ref, Ref, markRaw } from 'vue';
import { Tensor, tensor2d, zeros } from '@tensorflow/tfjs';
import configService from './ConfigService';
import gameService from './GameService';
import { Memory } from '../Memory';
import { Model } from '../Model';

export class AITrainingService {
  private model: Ref<Model | null> = ref(null);
  private memory: Ref<Memory>;
  private steps: Ref<number>;
  private trainingRounds: Ref<number>;
  private trainingDelay: Ref<number>;
  private noDelay: Ref<boolean>;
  private status: Ref<string> = ref('idle');
  private blockInput: Ref<boolean> = ref(false);
  
  constructor() {
    this.steps = ref(configService.getAIConfig().steps);
    this.trainingRounds = ref(configService.getAIConfig().trainingRounds);
    this.memory = ref(markRaw(new Memory(configService.getAIConfig().memorySlots)));
    this.trainingDelay = ref(configService.getUIConfig().trainingDelay);
    this.noDelay = ref(configService.getUIConfig().noDelay);
    
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
    configService.updateAIConfig({ steps });
  }
  
  public getTrainingRounds(): Ref<number> {
    return this.trainingRounds;
  }
  
  public setTrainingRounds(rounds: number): void {
    this.trainingRounds.value = rounds;
    configService.updateAIConfig({ trainingRounds: rounds });
  }
  
  public getTrainingDelay(): Ref<number> {
    return this.trainingDelay;
  }
  
  public setTrainingDelay(delay: number): void {
    this.trainingDelay.value = delay;
    configService.updateUIConfig({ trainingDelay: delay });
  }
  
  public getNoDelay(): Ref<boolean> {
    return this.noDelay;
  }
  
  public setNoDelay(noDelay: boolean): void {
    this.noDelay.value = noDelay;
    configService.updateUIConfig({ noDelay });
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
    
    const state = gameService.getState().value;
    const stateTensor: Tensor = tensor2d([state]);
    const action = this.model.value.chooseAction(stateTensor);
    const ret = gameService.shift(this.actionToDirection(action[0]));
    
    if (!ret) {
      await this.sleep(50);
    }
    
    return [gameService.isLost().value, gameService.isWon().value];
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
    
    gameService.reset();
    this.blockInput.value = true;
    await this.sleep(100);
    
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
  
  private async runTrainingEpisode(): Promise<void> {
    if (!this.model.value) {
      return;
    }
    
    let state: Tensor = tensor2d([gameService.getState().value]);
    let totalReward = 0;
    let step = 0;
    
    while (step < this.steps.value) {
      // Interaction with the environment
      const action = this.model.value.chooseAction(state);
      gameService.shift(this.actionToDirection(action[0]));
      
      const done = gameService.isWon().value || gameService.isLost().value;
      const reward = this.computeReward(
        gameService.getState().value,
        gameService.getCurrentScore().value,
        gameService.isLost().value
      );
      
      let nextState: Tensor = tensor2d([gameService.getState().value]);
      
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
        gameService.reset();
      }
      
      if (!this.noDelay.value) {
        await this.sleep(this.trainingDelay.value);
      }
    }
    
    await this.replay();
    gameService.reset();
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

// Create a singleton instance
const aiTrainingService = new AITrainingService();
export default aiTrainingService;