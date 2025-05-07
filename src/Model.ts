import {sequential, Sequential, Tensor, tidy, layers, sigmoid as sigmoidfn, div, sum, multinomial, LayersModel, train} from "@tensorflow/tfjs";
import {toRaw, isProxy} from "vue";

export class Model {
	readonly numStates: number;
	readonly numActions: number;
	readonly batchSize: number;
	network: Sequential;

	constructor(numStates: number, numAction: number, batchSize: number, model?: LayersModel, learningRate: number = 0.001) {
		this.numStates = numStates;
		this.numActions = numAction;
		this.batchSize = batchSize;
		if (model) {
			this.network = model as Sequential;
		} else {
			this.network = sequential();

			// Input layer
			this.network.add(layers.dense({
				units: 128,
				activation: 'relu',
				inputShape: [this.numStates],
			}));
			this.network.add(layers.batchNormalization());
			this.network.add(layers.dropout({rate: 0.2}));

			// Hidden layer 1
			this.network.add(layers.dense({
				units: 64,
				activation: 'relu',
			}));
			this.network.add(layers.batchNormalization());
			this.network.add(layers.dropout({rate: 0.2}));

			// Hidden layer 2
			this.network.add(layers.dense({
				units: 32,
				activation: 'relu',
			}));
			this.network.add(layers.batchNormalization());

			// Output layer
			this.network.add(layers.dense({
				units: this.numActions,
				activation: 'linear'
			}));
		}
		this.network.summary();
		this.network.compile({
			optimizer: train.adam(learningRate),
			loss: 'meanSquaredError'
		});
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
			const logits = this.network.predict(state) as Tensor;
			const sigmoid = sigmoidfn(logits);
			const probs = div(sigmoid, sum(sigmoid));
			return multinomial(probs, 1).dataSync();
		});
	}
}
