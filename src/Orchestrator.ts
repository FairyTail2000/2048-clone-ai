import { Model } from './Model';
import { Memory } from './Memory';

import { zeros, tensor2d, Tensor } from "@tensorflow/tfjs";
import GameTable from "./components/game-table.vue";

export class Orchestrator {
	private readonly model: Model;
	private memory: Memory;
	private steps: number;
	private readonly maxStepsPerGame: number;
	private gameTable: typeof GameTable;
	private readonly round_waiting: number;
	private readonly disable_wait: boolean;
	private discountRate: number = 0.95;

	constructor(gameTable: typeof GameTable, model: Model, memory: Memory, maxStepsPerGame: number, round_waiting: number, disable_wait: boolean) {
		// The main components of the environment
		this.model = model;
		this.memory = memory;
		this.gameTable = gameTable;

		// Keep tracking of the elapsed steps
		this.steps = 0;
		this.maxStepsPerGame = maxStepsPerGame;

		this.round_waiting = round_waiting;
		this.disable_wait = disable_wait;
	}

	computeReward(position: number[], current_score: number, lost: boolean, won: boolean): number {
		let reward = 0;

		// Find max tile value
		let max_value = Math.max(...position);

		// Reward based on max tile
		if (max_value >= 2048) reward += 10000;  // Major reward for reaching 2048
		else if (max_value >= 1024) reward += 1000;
		else if (max_value >= 512) reward += 500;
		else if (max_value >= 256) reward += 250;
		else if (max_value >= 128) reward += 125;
		else reward += max_value / 2;  // Small linear reward for low values

		// Add score component (smaller influence)
		reward += current_score / 20;

		// Game outcome multipliers
		if (won) reward *= 1.5;  // Bonus for winning
		// You absolute doorknob
		if (lost) reward *= 0.1;  // Severe penalty for losing

		return reward;
	}

	actionToAction(action: number): "left" | "right" | "up" | "down" | "" {
		switch (action) {
			case 0:
				return "up"
			case 1:
				return "down"
			case 2:
				return "right"
			case 3:
				return "left"
		}
		return ""
	}

	sleep(time: number) {
		return new Promise<void>((resolve) => {
			setTimeout(() => resolve(), time)
		})
	}

	async just_play(): Promise<boolean[]> {
		let state: Tensor = tensor2d([this.gameTable.state]);
		const action = this.model.chooseAction(state);
		const ret = this.gameTable.shift(this.actionToAction(action[0]));
		if (!ret) {
			await this.sleep(50);
		}
		return [this.gameTable.lost, this.gameTable.won]
	}

	async run() {
		let state: Tensor = tensor2d([this.gameTable.state]);
		let totalReward = 0;
		let step = 0;
		while (step < this.maxStepsPerGame) {
			// Interaction with the environment
			const action = this.model.chooseAction(state);
			this.gameTable.shift(this.actionToAction(action[0]));

			const done = this.gameTable.won || this.gameTable.lost;
			const reward = this.computeReward(this.gameTable.state, this.gameTable.current_score, this.gameTable.lost, this.gameTable.won);

			let nextState: Tensor = tensor2d([this.gameTable.state]);

			if (done) {
				this.memory.addSample([state, action, reward, null])
			} else {
				this.memory.addSample([state, action, reward, nextState])
			}

			this.steps += 1;

			state = nextState;
			totalReward += reward;
			step += 1;

			// Keep track of the max position reached and store the total reward
			if (step == this.maxStepsPerGame) {
				console.log("Achieved reward: " + totalReward);
				break;
			}
			if (done) {
				this.gameTable.reset();
			}
			if (!this.disable_wait) {
				await this.sleep(this.round_waiting);
			}

		}
		await this.replay()
		this.gameTable.reset();
	}

	async replay() {
		const batch = this.memory.sample(this.model.batchSize);

		// Create arrays for inputs and targets
		let x: any[] = [];
		let y: any[] = [];

		// Process each experience in the batch
		for (let i = 0; i < batch.length; i++) {
			const [state, action, reward, nextState] = batch[i];

			// Get current Q values for this state
			const currentQ = (this.model.predict(state) as any).dataSync();

			if (nextState === null) {
				// Terminal state - only use the reward
				// @ts-ignore
				currentQ[action] = reward;
			} else {
				// Non-terminal state - use reward plus discounted future reward
				const nextQ = this.model.predict(nextState);
				// @ts-ignore
				const maxNextQ = nextQ.max().dataSync()[0];
				// @ts-ignore
				currentQ[action] = reward + this.discountRate * maxNextQ;
				// @ts-ignore
				nextQ.dispose();
			}

			// Add to training batch
			x.push(state.dataSync());
			y.push(currentQ);
		}

		// Convert to tensors for training
		const xTensor = tensor2d(x, [x.length, this.model.numStates]);
		const yTensor = tensor2d(y, [y.length, this.model.numActions]);

		// Train the model
		await this.model.train(xTensor, yTensor);

		// Clean up
		xTensor.dispose();
		yTensor.dispose();
	}
}
