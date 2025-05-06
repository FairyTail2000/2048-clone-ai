import { Tensor } from "@tensorflow/tfjs";

type MemoryCell = [Tensor,  Float32Array<ArrayBufferLike> | Int32Array<ArrayBufferLike> | Uint8Array<ArrayBufferLike>, number, Tensor | null];


export class Memory {
	private readonly maxMemory: number;
	private readonly samples: MemoryCell[];
	private it = 0;

	constructor(maxMemory: number) {
		this.maxMemory = maxMemory;
		this.samples = new Array(maxMemory);
	}
	addSample(sample: MemoryCell) {
		this.samples[this.it++] = sample;
		if (this.it > this.maxMemory) {
			let [state, , , nextState] = this.samples.shift()!;
			if (state) state.dispose();
			if (nextState) nextState.dispose();
			this.it--;
		}
	}

	sample(nSamples: number) {
		// Get all available samples (filter out null/undefined entries)
		const availableSamples = this.samples.filter(s => s != null && s[3] !== null);

		// Calculate how many samples we can actually return
		const actualSamples = Math.min(nSamples, availableSamples.length);

		if (actualSamples < nSamples) {
			console.warn(`Requested ${nSamples} samples but only ${actualSamples} are available`);
		}

		// If we need all or most samples, shuffle the array instead of random selection
		if (actualSamples > availableSamples.length * 0.7) {
			// Fisher-Yates shuffle algorithm
			const shuffled = [...availableSamples];
			for (let i = shuffled.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
			}
			return shuffled.slice(0, actualSamples);
		}

		// For smaller sample sizes, use a more efficient approach with a Set
		const selectedIndices = new Set<number>();
		const result: MemoryCell[] = [];

		// Keep selecting unique random indices until we have enough samples
		while (selectedIndices.size < actualSamples) {
			const randomIndex = Math.floor(Math.random() * availableSamples.length);

			if (!selectedIndices.has(randomIndex)) {
				selectedIndices.add(randomIndex);
				result.push(availableSamples[randomIndex]);
			}
		}

		return result;
	}
}
