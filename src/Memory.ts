export class Memory {
	private readonly maxMemory: number;
	private readonly samples: any[];
	private it = 0;

	constructor(maxMemory: number) {
		this.maxMemory = maxMemory;
		this.samples = new Array(maxMemory);
	}

	addSample(sample: any[]) {
		this.samples[this.it++] = sample;
		if (this.it > this.maxMemory) {
			let [state, , , nextState] = this.samples.shift();
			if (state) state.dispose();
			if (nextState) nextState.dispose();
			this.it--;
		}
	}

	sample(nSamples: number) {
		// Ensure we don't request more samples than available
		const availableSamples = this.samples.filter(s => s !== undefined);
		const actualSamples = Math.min(nSamples, availableSamples.length);

		if (actualSamples < nSamples) {
			console.warn(`Requested ${nSamples} samples but only ${actualSamples} are available`);
		}

		// Use a Set to efficiently track selected indices
		const selectedIndices = new Set<number>();
		const result = [];

		// Safety counter to prevent infinite loops
		let attempts = 0;
		const maxAttempts = availableSamples.length * 3;

		while (result.length < actualSamples && attempts < maxAttempts) {
			const randomIndex = Math.floor(Math.random() * availableSamples.length);

			if (!selectedIndices.has(randomIndex)) {
				selectedIndices.add(randomIndex);
				result.push(availableSamples[randomIndex]);
			}

			attempts++;
		}

		// If we couldn't get enough unique samples, fill with duplicates
		if (result.length < actualSamples) {
			console.warn(`Could only find ${result.length} unique samples`);
			while (result.length < actualSamples) {
				const randomIndex = Math.floor(Math.random() * availableSamples.length);
				result.push(availableSamples[randomIndex]);
			}
		}

		return result;
	}
}
