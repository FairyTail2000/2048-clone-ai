import * as tf from '@tensorflow/tfjs';
import { Memory } from '../Memory';
import { Model } from '../Model';

// Define message types for communication with the main thread
interface TrainMessage {
  type: 'train';
  model: tf.io.ModelArtifacts;
  memoryData: any[];
  trainingRounds: number;
  steps: number;
  discountRate: number;
  tableSize: number;
}

interface TrainingProgressMessage {
  type: 'trainingProgress';
  round: number;
  totalRounds: number;
  reward: number;
}

interface TrainingCompleteMessage {
  type: 'trainingComplete';
  model: tf.io.ModelArtifacts;
}

// Listen for messages from the main thread
self.addEventListener('message', async (e: MessageEvent) => {
  const data = e.data as TrainMessage;
  
  if (data.type === 'train') {
    try {
      // Load the model from the serialized artifacts
      const model = await tf.loadLayersModel(tf.io.fromMemory(data.model));
      const modelInstance = new Model(
        data.tableSize * data.tableSize, // numStates
        4, // numActions (up, down, left, right)
        32, // batchSize
        model
      );
      
      // Create memory from the provided data
      const memory = new Memory(data.memoryData.length);
      for (const sample of data.memoryData) {
        memory.addSample(sample);
      }
      
      // Start training
      await trainModel(
        modelInstance,
        memory,
        data.trainingRounds,
        data.steps,
        data.discountRate,
        data.tableSize
      );
      
      // When training is complete, send the updated model back
      const savedModel = await model.save(tf.io.withSaveHandler(async (artifacts) => {
        return artifacts;
      }));
      
      self.postMessage({
        type: 'trainingComplete',
        model: savedModel
      } as TrainingCompleteMessage);
    } catch (error) {
      self.postMessage({
        type: 'error',
        error: error.toString()
      });
    }
  }
});

// Simplified game state for the worker
class GameState {
  private state: number[];
  private score: number = 0;
  private lost: boolean = false;
  private won: boolean = false;
  private tableSize: number;
  
  constructor(tableSize: number) {
    this.tableSize = tableSize;
    this.state = new Array(tableSize * tableSize).fill(0);
    this.reset();
  }
  
  reset(): void {
    this.state.fill(0);
    this.score = 0;
    this.lost = false;
    this.won = false;
    this.generateNewTile();
    this.generateNewTile();
  }
  
  getState(): number[] {
    return [...this.state];
  }
  
  getScore(): number {
    return this.score;
  }
  
  isLost(): boolean {
    return this.lost;
  }
  
  isWon(): boolean {
    return this.won;
  }
  
  generateNewTile(): void {
    const emptyTiles = this.state
      .map((value, index) => ({ value, index }))
      .filter(tile => tile.value === 0)
      .map(tile => tile.index);
    
    if (emptyTiles.length === 0) {
      this.lost = true;
      return;
    }
    
    const randomIndex = emptyTiles[Math.floor(Math.random() * emptyTiles.length)];
    this.state[randomIndex] = Math.random() < 0.9 ? 2 : 4;
    
    // Check if won (has 2048 tile)
    if (this.state.includes(2048)) {
      this.won = true;
    }
  }
  
  shift(direction: 'up' | 'down' | 'left' | 'right'): boolean {
    // Simplified shift implementation
    // In a real implementation, this would handle the game logic for shifting tiles
    // For now, we'll just simulate a random shift result
    
    // Randomly determine if the shift was successful
    const success = Math.random() > 0.2;
    
    if (success) {
      // Simulate a successful shift by updating a random empty tile
      this.generateNewTile();
      // Increase score
      this.score += 2;
    }
    
    return success;
  }
}

// Training function
async function trainModel(
  model: Model,
  memory: Memory,
  trainingRounds: number,
  steps: number,
  discountRate: number,
  tableSize: number
): Promise<void> {
  const gameState = new GameState(tableSize);
  
  for (let i = 0; i < trainingRounds; i++) {
    // Report progress to main thread
    self.postMessage({
      type: 'trainingProgress',
      round: i + 1,
      totalRounds: trainingRounds,
      reward: 0
    } as TrainingProgressMessage);
    
    await runTrainingEpisode(model, memory, gameState, steps, discountRate);
  }
}

// Run a single training episode
async function runTrainingEpisode(
  model: Model,
  memory: Memory,
  gameState: GameState,
  steps: number,
  discountRate: number
): Promise<void> {
  gameState.reset();
  
  let state: tf.Tensor = tf.tensor2d([gameState.getState()]);
  let totalReward = 0;
  let step = 0;
  
  while (step < steps) {
    // Choose action based on current state
    const action = model.chooseAction(state);
    
    // Convert action to direction
    const direction = actionToDirection(action[0]);
    
    // Apply action to game state
    gameState.shift(direction);
    
    // Check if game is over
    const done = gameState.isWon() || gameState.isLost();
    
    // Calculate reward
    const reward = computeReward(
      gameState.getState(),
      gameState.getScore(),
      gameState.isLost()
    );
    
    // Get next state
    let nextState: tf.Tensor = tf.tensor2d([gameState.getState()]);
    
    // Add sample to memory
    if (done) {
      memory.addSample([state, action, reward, null]);
    } else {
      memory.addSample([state, action, reward, nextState]);
    }
    
    // Update state
    state = nextState;
    totalReward += reward;
    step += 1;
    
    // If done, reset game state
    if (done) {
      gameState.reset();
    }
    
    // If reached max steps, break
    if (step === steps) {
      break;
    }
  }
  
  // Report total reward
  self.postMessage({
    type: 'trainingProgress',
    round: 0,
    totalRounds: 0,
    reward: totalReward
  } as TrainingProgressMessage);
  
  // Perform replay (learning)
  await replay(model, memory, discountRate);
}

// Convert action number to direction
function actionToDirection(action: number): 'up' | 'down' | 'left' | 'right' {
  switch (action) {
    case 0:
      return 'up';
    case 1:
      return 'down';
    case 2:
      return 'right';
    case 3:
      return 'left';
    default:
      return 'up'; // Default to up if invalid action
  }
}

// Compute reward based on game state
function computeReward(position: number[], currentScore: number, lost: boolean): number {
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

// Replay function for learning
async function replay(model: Model, memory: Memory, discountRate: number): Promise<void> {
  // Sample from memory
  const batch = memory.sample(model.batchSize);
  const states = batch.map(([state, , ,]) => state);
  const nextStates = batch.map(
    ([, , , nextState]) => nextState ? nextState : tf.zeros([model.numStates])
  );
  
  // Predict the values of each action at each state
  const qsa = states.map((state) => model.predict(state));
  // Predict the values of each action at each next state
  const qsad = nextStates.map((nextState) => model.predict(nextState));
  
  let x: any[] | tf.Tensor = [];
  let y: any[] | tf.Tensor = [];
  
  // Update the states rewards with the discounted next states rewards
  batch.forEach(
    ([state, action, reward, nextState], index) => {
      const currentQ: any = qsa[index];
      currentQ[action] = nextState ? reward + discountRate * qsad[index].max().dataSync() : reward;
      x.push(state.dataSync());
      y.push(currentQ.dataSync());
    }
  );
  
  // Clean unused tensors
  qsa.forEach((state) => state.dispose());
  qsad.forEach((state) => state.dispose());
  
  // Reshape the batches to be fed to the network
  x = tf.tensor2d(x, [x.length, model.numStates]);
  y = tf.tensor2d(y, [y.length, model.numActions]);
  
  // Learn the Q(s, a) values given associated discounted rewards
  await model.train(x, y);
  
  x.dispose();
  y.dispose();
}