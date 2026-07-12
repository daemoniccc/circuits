
export class Inductor {
    constructor(
        a,
        b,
        inductance,
        initialCurrent = 0,
        seriesResistance = 0,
        saturationCurrent = Infinity,
        parallelCapacitance = 0,
    ) {
        this.a = a;
        this.b = b;
        this.L = inductance;
        this.R = seriesResistance;
        this.C = parallelCapacitance;
        this.saturationCurrent = saturationCurrent;
        this.I = initialCurrent;
        this.previousCurrent = initialCurrent;
        this.V = 0;
        this.flux = inductance * initialCurrent;
    }

    get type() {
        return "Inductor";
    }

    effectiveInductance(current = this.I) {
        if (!Number.isFinite(this.saturationCurrent)) return this.L;
        if (this.saturationCurrent <= 0) return this.L;

        const ratio = Math.abs(current) / this.saturationCurrent;
        return this.L / Math.sqrt(1 + ratio * ratio);
    }

    updateCurrent(current, dt) {
        if (dt <= 0)
            throw new RangeError("Inductor dt must be greater than zero.");

        const inductance = this.effectiveInductance(current);
        this.previousCurrent = this.I;
        this.I = current;
        this.V =
            inductance * ((this.I - this.previousCurrent) / dt) +
            this.R * this.I;
        this.flux = inductance * this.I;
        return this.V;
    }

    companionResistance(dt) {
        if (dt <= 0)
            throw new RangeError("Inductor dt must be greater than zero.");
        return this.R + this.effectiveInductance() / dt;
    }
}

export class Transistor {
    static types = ["nmos", "pmos"];

    constructor(
        gate,
        drain,
        source,
        transistorType = "nmos",
        thresholdVoltage = 1,
        transconductance = 0.001,
        channelLengthModulation = 0,
    ) {
        this.g = gate;
        this.d = drain;
        this.s = source;
        this.transistorType = Transistor.types.includes(transistorType)
            ? transistorType
            : "nmos";
        this.Vth = thresholdVoltage;
        this.K = transconductance;
        this.lambda = channelLengthModulation;
        this.Vgs = 0;
        this.Vds = 0;
        this.Id = 0;
    }

    get type() {
        return "Transistor";
    }

    drainCurrent(vgs, vds) {
        const polarity = this.transistorType === "pmos" ? -1 : 1;
        const controlVoltage = polarity * vgs;
        const outputVoltage = Math.max(0, polarity * vds);
        const threshold = Math.abs(this.Vth);
        const overdrive = controlVoltage - threshold;

        if (overdrive <= 0 || outputVoltage <= 0) return 0;

        const modulation = 1 + this.lambda * outputVoltage;
        let current;

        if (outputVoltage < overdrive) {
            current =
                this.K *
                (overdrive * outputVoltage -
                    (outputVoltage * outputVoltage) / 2) *
                modulation;
        } else {
            current = 0.5 * this.K * overdrive * overdrive * modulation;
        }

        return polarity * current;
    }

    update(vgs, vds) {
        this.Vgs = vgs;
        this.Vds = vds;
        this.Id = this.drainCurrent(vgs, vds);
        return this.Id;
    }

    transconductanceAt(vgs, vds) {
        const epsilon = 1e-6;
        return (
            (this.drainCurrent(vgs + epsilon, vds) -
                this.drainCurrent(vgs - epsilon, vds)) /
            (2 * epsilon)
        );
    }

    outputConductanceAt(vgs, vds) {
        const epsilon = 1e-6;
        return (
            (this.drainCurrent(vgs, vds + epsilon) -
                this.drainCurrent(vgs, vds - epsilon)) /
            (2 * epsilon)
        );
    }
}
