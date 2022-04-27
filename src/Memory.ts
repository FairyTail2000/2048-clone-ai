export class Memory {
	private readonly maxMemory: number;
	private readonly samples: any[];
	private it = 0;

	constructor(maxMemory: number) {
		this.maxMemory = maxMemory;
		this.samples = new Array(maxMemory - 1);
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
		if (nSamples > this.samples.length) {
			console.assert(nSamples > this.samples.length);
		}
		let samples = new Array(nSamples);
		while (samples.length !== nSamples) {
			const el = this.samples[Math.random() * this.samples.length];
			if (!samples.includes(el)) {
				samples.push(el)
			}
		}
		return samples;
	}
}
