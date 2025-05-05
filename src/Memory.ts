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
		// Get all available samples (filter out undefined entries)
		const availableSamples = this.samples.filter(s => s !== undefined);

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
		const result = [];

		// Keep selecting unique random indices until we have enough samples
		while (selectedIndices.size < actualSamples) {
			const randomIndex = Math.floor(Math.random() * availableSamples.length);

			if (!selectedIndices.has(randomIndex)) {
				selectedIndices.add(randomIndex);
				result.push(availableSamples[randomIndex]);
			}
		}

		return result;
	}}
