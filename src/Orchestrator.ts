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

	computeReward(position: number[], current_score: number, lost: boolean): number {
		let reward = 0;
		let max_value = position.reduce((previousValue, currentValue) => {
			if (previousValue < currentValue) {
				return currentValue;
			} else {
				return previousValue;
			}
		});

		if (max_value <= 64) {
			reward = 5;
		} else if (max_value === 128) {
			reward = 20;
		} else if (max_value === 256) {
			reward = 40;
		} else if (max_value === 512) {
			reward = 60;
		} else if (max_value === 1024) {
			reward = 80;
		} else if (max_value === 2048) {
			reward = 100;
		}

		if (current_score < 100) {
			reward -= 10;
		} else if (current_score < 200) {
			reward += 10;
		} else if (current_score < 300) {
			reward += 20;
		} else if (current_score >= 300) {
			reward += 40;
		}

		if (lost) {
			reward -= 50;
		}
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
		let state: Tensor | null = tensor2d([this.gameTable.state]);
		const action = this.model.chooseAction(state);
		const ret = this.gameTable.shift(this.actionToAction(action[0]));
		if (!ret) {
			await this.sleep(50);
		}
		return [this.gameTable.lost, this.gameTable.won]
	}

	async run() {
		let state: Tensor | null = tensor2d([this.gameTable.state]);
		let totalReward = 0;
		let step = 0;
		while (step < this.maxStepsPerGame) {
			// Interaction with the environment
			const action = this.model.chooseAction(state);
			this.gameTable.shift(this.actionToAction(action[0]));

			const done = this.gameTable.won || this.gameTable.lost;
			const reward = this.computeReward(this.gameTable.state, this.gameTable.current_score, this.gameTable.lost);

			let nextState: Tensor | null = tensor2d([this.gameTable.state]);

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
		// Sample from memory
		const batch = this.memory.sample(this.model.batchSize);
		const states = batch.map(([state, , , ]) => state);
		const nextStates = batch.map(
			([, , , nextState]) => nextState ? nextState : zeros([this.model.numStates])
		);
		// Predict the values of each action at each state
		const qsa = states.map((state) => this.model.predict(state));
		// Predict the values of each action at each next state
		const qsad = nextStates.map((nextState) => this.model.predict(nextState));

		let x: any[] | Tensor = [];
		let y: any[] | Tensor = [];

		// Update the states rewards with the discounted next states rewards
		batch.forEach(
			([state, action, reward, nextState], index) => {
				const currentQ: any = qsa[index];
				//@ts-ignore
				currentQ[action] = nextState ? reward + this.discountRate * qsad[index].max().dataSync() : reward;
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
		x = tensor2d(x, [x.length, this.model.numStates])
		y = tensor2d(y, [y.length, this.model.numActions])

		// Learn the Q(s, a) values given associated discounted rewards
		await this.model.train(x, y);

		x.dispose();
		y.dispose();
	}
}
