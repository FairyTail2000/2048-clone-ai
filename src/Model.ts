import {sequential, Sequential, Tensor, tidy, layers, sigmoid as sigmoidfn, div, sum, multinomial, LayersModel} from "@tensorflow/tfjs";
import {toRaw, isProxy} from "vue";

export class Model {
	readonly numStates: number;
	readonly numActions: number;
	readonly batchSize: number;
	readonly network: Sequential;

	constructor(numStates: number, numAction: number, batchSize: number, model?: LayersModel) {
		this.numStates = numStates;
		this.numActions = numAction;
		this.batchSize = batchSize;
		if (model) {
			this.network = model as Sequential;
		} else {
			this.network = sequential();
			this.network.add(layers.dense({
				units: 36,
				activation: 'relu',
				inputShape: [this.numStates]
			}));
			this.network.add(layers.dense({
				units: 36,
				activation: 'sigmoid',
				inputShape: [this.numStates],
				kernelInitializer: "glorotNormal"
			}));
			this.network.add(layers.dense({
				units: 26,
				activation: 'relu',
				inputShape: [this.numStates]
			}));
			this.network.add(layers.dense({units: this.numActions}));
		}
		this.network.summary();
		this.network.compile({optimizer: 'adam', loss: 'meanSquaredError'});
	}

	predict(states: Tensor | Tensor[]) {
		return tidy(() => this.network.predict(states));
	}

	async train(xBatch: Tensor | Tensor[], yBatch: Tensor | Tensor[]) {
		await this.network.fit(xBatch, yBatch);
	}

	async saveModel(save_path: string) {
		if (isProxy(this.network)) {
			const unproxied: Sequential = toRaw(this.network);
			return await unproxied.save(save_path);
		} else {
			return await this.network.save(save_path);
		}
	}

	chooseAction(state: Tensor | Tensor[]) {
		return tidy(() => {
			const logits = this.network.predict(state);
			//@ts-ignore
			const sigmoid = sigmoidfn(logits);
			const probs = div(sigmoid, sum(sigmoid));
			//@ts-ignore
			return multinomial(probs, 1).dataSync();
		});
	}
}
