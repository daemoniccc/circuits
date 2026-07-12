export class Node {
    constructor(v, fixed) {
        this.V = v;
        this.fixed = fixed;
        this.I = 0;
    }

    get type() {
        return "Node";
    }
}

export class Resistor {
    constructor(a, b, r) {
        this.a = a;
        this.b = b;
        this.R = r;
        this.I = 0;
    }

    get type() {
        return "Resistor";
    }
}

export class NonOhmicResistor {
    constructor(a, b, fx, dfx) {
        this.a = a;
        this.b = b;
        this.fx = fx;
        this.dfx = dfx;
    }

    get type() {
        return "NonOhmic";
    }

    I(V) {
        return this.fx(V);
    }

    g(V) {
        return this.dfx(V);
    }
}

export class VSource {
    constructor(a, b, V) {
        this.a = a;
        this.b = b;
        this.V = V;
        this.I = 0;
    }

    get type() {
        return "VSource";
    }
}

export class ISource {
    constructor(a, b, I) {
        this.a = a;
        this.b = b;
        this.I = I;
    }

    get type() {
        return "ISource";
    }
}

export class Capacitor {
    constructor(a, b, C) {
        this.a = a;
        this.b = b;
        this.C = C;
        this.V = 0;
    }

    get type() {
        return "Capacitor";
    }
}

export class WaveData {
    constructor() {
        this.time = 0;
        this.output = undefined;
    }

    value(time = this.time) {
        return this.valueAt(time);
    }

    timeStep(time) {
        if (!Number.isFinite(time) || time < 0) {
            throw new RangeError(
                "Waveform time must be a finite, non-negative number.",
            );
        }

        this.time = time;
        this.output = this.valueAt(this.time);
        return this.output;
    }

    reset(time = 0) {
        return this.timeStep(time);
    }

    setTime(time) {
        return this.timeStep(time);
    }
}

class PeriodicWave extends WaveData {
    constructor(frequency, phase = 0) {
        super();
        this.frequency = frequency;
        this.phase = phase;
    }

    cycleAt(time) {
        const cycle = time * this.frequency + this.phase / 360;
        return ((cycle % 1) + 1) % 1;
    }
}

export class SineWave extends PeriodicWave {
    constructor(offset = 0, amplitude = 1, frequency = 1, phase = 0) {
        super(frequency, phase);
        this.offset = offset;
        this.amplitude = amplitude;
        this.reset();
    }

    get type() {
        return "SineWave";
    }

    valueAt(time) {
        return (
            this.offset +
            this.amplitude * Math.sin(this.cycleAt(time) * Math.PI * 2)
        );
    }
}

export class SawWave extends PeriodicWave {
    constructor(offset = 0, amplitude = 1, frequency = 1, phase = 0) {
        super(frequency, phase);
        this.offset = offset;
        this.amplitude = amplitude;
        this.reset();
    }

    get type() {
        return "SawWave";
    }

    valueAt(time) {
        return this.offset + this.amplitude * (this.cycleAt(time) * 2 - 1);
    }
}

export class SquareWave extends PeriodicWave {
    constructor(low = 0, high = 1, frequency = 1, dutyCycle = 50, phase = 0) {
        super(frequency, phase);
        this.low = low;
        this.high = high;
        this.dutyCycle = dutyCycle;
        this.reset();
    }

    get type() {
        return "SquareWave";
    }

    valueAt(time) {
        const duty = Math.max(0, Math.min(100, this.dutyCycle)) / 100;
        return this.cycleAt(time) < duty ? this.high : this.low;
    }
}

export class TriangleWave extends PeriodicWave {
    constructor(offset = 0, amplitude = 1, frequency = 1, phase = 0) {
        super(frequency, phase);
        this.offset = offset;
        this.amplitude = amplitude;
        this.reset();
    }

    get type() {
        return "TriangleWave";
    }

    valueAt(time) {
        const normalised = 1 - 4 * Math.abs(this.cycleAt(time) - 0.5);
        return this.offset + this.amplitude * normalised;
    }
}

export class PulseWave extends WaveData {
    constructor(
        low = 0,
        high = 1,
        delay = 0,
        riseTime = 0,
        fallTime = 0,
        width = 0.5,
        period = 1,
    ) {
        super();
        this.low = low;
        this.high = high;
        this.delay = delay;
        this.riseTime = riseTime;
        this.fallTime = fallTime;
        this.width = width;
        this.period = period;
        this.reset();
    }

    get type() {
        return "PulseWave";
    }

    valueAt(time) {
        if (time < this.delay || this.period <= 0) return this.low;

        const elapsed = time - this.delay;
        const cycle = ((elapsed % this.period) + this.period) % this.period;
        const riseTime = Math.max(0, this.riseTime);
        const width = Math.max(0, this.width);
        const fallTime = Math.max(0, this.fallTime);
        const highStart = riseTime;
        const highEnd = highStart + width;
        const fallEnd = highEnd + fallTime;

        if (riseTime > 0 && cycle < highStart) {
            return this.low + (this.high - this.low) * (cycle / riseTime);
        }

        if (cycle < highEnd) return this.high;

        if (fallTime > 0 && cycle < fallEnd) {
            const progress = (cycle - highEnd) / fallTime;
            return this.high + (this.low - this.high) * progress;
        }

        return this.low;
    }
}

export class StepWave extends WaveData {
    constructor(initial = 0, final = 1, delay = 0, riseTime = 0) {
        super();
        this.initial = initial;
        this.final = final;
        this.delay = delay;
        this.riseTime = riseTime;
        this.reset();
    }

    get type() {
        return "StepWave";
    }

    valueAt(time) {
        if (time < this.delay) return this.initial;
        if (this.riseTime <= 0 || time >= this.delay + this.riseTime) {
            return this.final;
        }

        const progress = (time - this.delay) / this.riseTime;
        return this.initial + (this.final - this.initial) * progress;
    }
}

export class WaveGenerator {
    static sourceTypes = ["voltage", "current"];

    constructor(a, b, waveform, sourceType = "voltage") {
        if (!waveform || typeof waveform.timeStep !== "function") {
            throw new TypeError(
                "WaveGenerator requires a waveform with timeStep(time).",
            );
        }

        this.a = a;
        this.b = b;
        this.waveform = waveform;
        this.sourceType = "voltage";
        this.V = 0;
        this.I = 0;
        this.output = waveform.output ?? waveform.value();
        this.setSourceType(sourceType);
    }

    get type() {
        return this.sourceType === "current" ? "ISource" : "VSource";
    }

    setSourceType(sourceType) {
        const normalisedType = String(sourceType).toLowerCase();

        if (!WaveGenerator.sourceTypes.includes(normalisedType)) {
            throw new RangeError(
                `WaveGenerator source type must be one of: ${WaveGenerator.sourceTypes.join(
                    ", ",
                )}.`,
            );
        }

        this.sourceType = normalisedType;
        this.applyOutput(this.output);
        return this.type;
    }

    applyOutput(output) {
        this.output = output;

        if (this.sourceType === "current") {
            this.I = output;
            this.V = 0;
        } else {
            this.V = output;
            this.I = 0;
        }

        return output;
    }

    timeStep(time) {
        return this.applyOutput(this.waveform.timeStep(time));
    }

    setTime(time) {
        return this.applyOutput(this.waveform.setTime(time));
    }

    reset(time = 0) {
        return this.applyOutput(this.waveform.reset(time));
    }
}
