import { Vector } from "./maths.js";

const gridSize = 10;

function isSelectable(layer, lower, upper) {
    return layer <= upper && layer >= lower;
}

function worldToScreen(v, zoom, pan) {
    return new Vector(
        v.x * gridSize * zoom + pan.x,

        v.y * gridSize * zoom + pan.y,
    );
}

function rotatePoint(p, angle) {
    const radians = (angle * Math.PI) / 180;
    const c = Math.cos(radians);

    const s = Math.sin(radians);

    return new Vector(
        p.x * c - p.y * s,

        p.x * s + p.y * c,
    );
}

function drawPath(ctx, points, position, rotation, zoom, pan) {
    ctx.beginPath();

    points.forEach((p, i) => {
        const world = position.add(rotatePoint(p, rotation));

        const screen = worldToScreen(world, zoom, pan);

        if (i === 0) ctx.moveTo(screen.x, screen.y);
        else ctx.lineTo(screen.x, screen.y);
    });

    ctx.stroke();
}

function drawCircle(
    ctx,
    centre,
    radius,
    position,
    rotation,
    zoom,
    pan,
    fill = false,
) {
    const world = position.add(rotatePoint(centre, rotation));

    const screen = worldToScreen(world, zoom, pan);

    ctx.beginPath();

    ctx.arc(screen.x, screen.y, radius * zoom, 0, Math.PI * 2);

    if (fill) {
        ctx.fill();
    } else {
        ctx.stroke();
    }
}

function parseBoolean(value) {
    if (typeof value === "boolean") return value;
    return value.toLowerCase() === "true";
}

export class Component {
    constructor(name, position, rotation, layer = 0) {
        this.name = name;
        this.position = position;
        this.connections = [];
        this.terminalLabels = [];

        this.selectedTerminal = 0;
        this.hoveredTerminal = 0;

        this.selected = false;
        this.visible = true;
        this.layer = layer;
        this.hovered = false;
        this.rotation = rotation;
        this.size = new Vector(0, 0);
    }

    get type() {
        return "Component";
    }

    draw(ctx, zoom, pan) {
        this.applyStyle(ctx);
        this.drawTerminals(ctx, zoom, pan);
    }

    getProperties() {
        return {
            Name: this.name,

            Rotation: this.rotation,

            Layer: this.layer,

            Visible: this.visible,

            Position: {
                X: this.position.x,

                Y: this.position.y,
            },
        };
    }

    onMouseMove(mouseGridPos, lower, upper) {
        this.selectedTerminal = 0;
        this.selected = false;
        if (!isSelectable(this.layer, lower, upper)) {
            this.hovered = false;

            this.hoveredTerminal = 0;
            return;
        }

        if (!this.visible || !mouseGridPos) {
            this.hovered = false;

            this.hoveredTerminal = 0;
            return;
        }

        const relativeMousePos = mouseGridPos.subtract(this.position);
        const localMousePos = rotatePoint(relativeMousePos, -this.rotation);

        const uppera = new Vector(this.size.x, this.size.y / 2);
        const lowera = new Vector(0, -this.size.y / 2);

        this.hovered = localMousePos.withinBounds(uppera, lowera);
    }

    setProperty(name, value) {
        if (name === "Name") this.name = value;

        if (name === "Position.X") this.position.x = Number(value);

        if (name === "Position.Y") this.position.y = Number(value);

        if (name === "Rotation") this.rotation = Number(value);

        if (name === "Layer") this.layer = Number(value);

        if (name === "Visible") this.visible = parseBoolean(value);
    }

    applyStyle(ctx) {
        if (this.selected) {
            ctx.lineWidth = 4;
            ctx.strokeStyle = "#ffb000";
        } else if (this.hovered) {
            ctx.lineWidth = 3;
            ctx.strokeStyle = "#52a7ff";
        } else {
            ctx.lineWidth = 2;
            ctx.strokeStyle = "#e8e8e8";
        }

        ctx.fillStyle = ctx.strokeStyle;

        ctx.lineCap = "round";

        ctx.lineJoin = "round";
    }

    drawTerminals(ctx, zoom, pan) {
        for (const connection of this.connections) {
            drawCircle(
                ctx,
                connection,
                3,
                this.position,
                this.rotation,
                zoom,
                pan,
                true,
            );
        }
    }

    drawTerminalLabels(ctx, zoom, pan) {
        if (!this.hovered || this.terminalLabels.length === 0) return;

        const centre = new Vector(this.size.x / 2, 0);

        ctx.save();
        ctx.fillStyle = "#52a7ff";
        ctx.font = "12px Arial";
        ctx.textBaseline = "middle";

        for (let i = 0; i < this.connections.length; i++) {
            const label = this.terminalLabels[i];
            if (!label) continue;

            const connection = this.connections[i];
            let direction = connection.subtract(centre).normalize();

            if (direction.magnitude() === 0) {
                direction = new Vector(0, -1);
            }

            const rotatedConnection = rotatePoint(connection, this.rotation);
            const rotatedDirection = rotatePoint(direction, this.rotation);
            const terminalScreen = worldToScreen(
                this.position.add(rotatedConnection),
                zoom,
                pan,
            );
            const labelOffset = 20;
            const x = terminalScreen.x + rotatedDirection.x * labelOffset;
            const y = terminalScreen.y + rotatedDirection.y * labelOffset;

            if (rotatedDirection.x > 0.25) {
                ctx.textAlign = "left";
            } else if (rotatedDirection.x < -0.25) {
                ctx.textAlign = "right";
            } else {
                ctx.textAlign = "center";
            }

            ctx.fillText(label, x, y);
        }

        ctx.restore();
    }
}

export class Resistor extends Component {
    constructor(name, position, rotation, layer, resistance) {
        super(name, position, rotation, layer);

        this.resistance = resistance;
        this.potentialDifference = 0;
        this.current = 0;

        this.size = new Vector(5, 1);

        this.connections = [new Vector(0, 0), new Vector(this.size.x, 0)];
    }

    get type() {
        return "Resistor";
    }

    getProperties() {
        return {
            ...super.getProperties(),

            Parameters: {
                R: this.resistance,
            },

            ReadOnly: {
                V: this.potentialDifference,
                I: this.current,
            },
        };
    }

    setProperty(name, value) {
        super.setProperty(name, value);

        if (name === "Parameters.R") this.resistance = Number(value);
    }

    draw(ctx, zoom, pan) {
        if (!this.visible) return;

        super.draw(ctx, zoom, pan);

        const pathA = [
            new Vector(0, 0.5),
            new Vector(0.2, 0.5),
            new Vector(0.2, 0),
            new Vector(0.8, 0),
            new Vector(0.8, 0.5),
            new Vector(1, 0.5),
            new Vector(0.8, 0.5),
            new Vector(0.8, 1),
            new Vector(0.2, 1),
            new Vector(0.2, 0.5),
        ];

        const path = [];

        for (const point of pathA) {
            path.push(
                new Vector(
                    point.x * this.size.x,
                    point.y * this.size.y - this.size.y / 2,
                ),
            );
        }

        drawPath(ctx, path, this.position, this.rotation, zoom, pan);
    }
}

export class Capacitor extends Component {
    constructor(name, position, rotation, layer, capacitance) {
        super(name, position, rotation, layer);

        this.capacitance = capacitance;
        this.potentialDifference = 0;
        this.current = 0;
        this.size = new Vector(5, 2);
        this.connections = [new Vector(0, 0), new Vector(this.size.x, 0)];
    }

    get type() {
        return "Capacitor";
    }

    getProperties() {
        return {
            ...super.getProperties(),

            Parameters: {
                C: this.capacitance,
            },

            ReadOnly: {
                V: this.potentialDifference,
                I: this.current,
            },
        };
    }

    setProperty(name, value) {
        super.setProperty(name, value);

        if (name === "Parameters.C") this.capacitance = Number(value);
    }

    draw(ctx, zoom, pan) {
        if (!this.visible) return;

        super.draw(ctx, zoom, pan);

        const leftPlateX = 2;
        const rightPlateX = 3;
        const halfPlateHeight = this.size.y / 2;

        const paths = [
            [new Vector(0, 0), new Vector(leftPlateX, 0)],
            [
                new Vector(leftPlateX, -halfPlateHeight),
                new Vector(leftPlateX, halfPlateHeight),
            ],
            [
                new Vector(rightPlateX, -halfPlateHeight),
                new Vector(rightPlateX, halfPlateHeight),
            ],
            [new Vector(rightPlateX, 0), new Vector(this.size.x, 0)],
        ];

        for (const path of paths) {
            drawPath(ctx, path, this.position, this.rotation, zoom, pan);
        }
    }
}

export class UniversalInductor extends Component {
    constructor(name, position, rotation, layer, inductance) {
        super(name, position, rotation, layer);

        this.inductance = inductance;
        this.seriesResistance = 0;
        this.initialCurrent = 0;
        this.saturationCurrent = 10;
        this.parallelCapacitance = 0;
        this.potentialDifference = 0;
        this.current = 0;
        this.flux = 0;
        this.size = new Vector(5, 2);
        this.connections = [new Vector(0, 0), new Vector(this.size.x, 0)];
    }

    get type() {
        return "UniversalInductor";
    }

    getProperties() {
        return {
            ...super.getProperties(),

            Parameters: {
                L: this.inductance,
                "Series Resistance": this.seriesResistance,
                "Initial Current": this.initialCurrent,
                "Saturation Current": this.saturationCurrent,
                "Parallel Capacitance": this.parallelCapacitance,
            },

            ReadOnly: {
                V: this.potentialDifference,
                I: this.current,
                Flux: this.flux,
            },
        };
    }

    setProperty(name, value) {
        super.setProperty(name, value);

        if (name === "Parameters.L") this.inductance = Number(value);
        if (name === "Parameters.Series Resistance") {
            this.seriesResistance = Number(value);
        }
        if (name === "Parameters.Initial Current") {
            this.initialCurrent = Number(value);
        }
        if (name === "Parameters.Saturation Current") {
            this.saturationCurrent = Number(value);
        }
        if (name === "Parameters.Parallel Capacitance") {
            this.parallelCapacitance = Number(value);
        }
    }

    draw(ctx, zoom, pan) {
        if (!this.visible) return;

        super.draw(ctx, zoom, pan);

        const coilPath = [];
        const coilStart = 1;
        const coilEnd = 4;
        const samples = 48;
        const turns = 4;

        for (let i = 0; i <= samples; i++) {
            const progress = i / samples;
            coilPath.push(
                new Vector(
                    coilStart + (coilEnd - coilStart) * progress,
                    -Math.abs(Math.sin(progress * turns * Math.PI)) * 0.75,
                ),
            );
        }

        const paths = [
            [new Vector(0, 0), new Vector(coilStart, 0)],
            coilPath,
            [new Vector(coilEnd, 0), new Vector(this.size.x, 0)],
        ];

        for (const path of paths) {
            drawPath(ctx, path, this.position, this.rotation, zoom, pan);
        }
    }
}

export class Diode extends Component {
    constructor(name, position, rotation, layer) {
        super(name, position, rotation, layer);

        this.forwardVoltage = 0.7;
        this.saturationCurrent = 1e-12;
        this.idealityFactor = 1;
        this.potentialDifference = 0;
        this.current = 0;
        this.size = new Vector(4, 2);
        this.connections = [new Vector(0, 0), new Vector(this.size.x, 0)];
    }

    get type() {
        return "Diode";
    }

    getProperties() {
        return {
            ...super.getProperties(),

            Parameters: {
                Vf: this.forwardVoltage,
                Is: this.saturationCurrent,
                N: this.idealityFactor,
            },

            ReadOnly: {
                V: this.potentialDifference,
                I: this.current,
            },
        };
    }

    setProperty(name, value) {
        super.setProperty(name, value);

        if (name === "Parameters.Vf") this.forwardVoltage = Number(value);
        if (name === "Parameters.Is") this.saturationCurrent = Number(value);
        if (name === "Parameters.N") this.idealityFactor = Number(value);
    }

    draw(ctx, zoom, pan) {
        if (!this.visible) return;

        super.draw(ctx, zoom, pan);

        const paths = [
            [new Vector(0, 0), new Vector(1.25, 0)],
            [
                new Vector(1.25, -1),
                new Vector(2.75, 0),
                new Vector(1.25, 1),
                new Vector(1.25, -1),
            ],
            [new Vector(2.75, -1), new Vector(2.75, 1)],
            [new Vector(2.75, 0), new Vector(this.size.x, 0)],
        ];

        for (const path of paths) {
            drawPath(ctx, path, this.position, this.rotation, zoom, pan);
        }
    }
}

export class MOSFET extends Component {
    static types = ["nmos", "pmos"];

    constructor(name, position, rotation, layer, mosfetType = "nmos") {
        super(name, position, rotation, layer);

        this.mosfetType = MOSFET.types.includes(mosfetType)
            ? mosfetType
            : "nmos";
        this.thresholdVoltage = 1;
        this.transconductance = 0.001;
        this.channelLengthModulation = 0;
        this.gateSourceVoltage = 0;
        this.drainSourceVoltage = 0;
        this.drainCurrent = 0;
        this.size = new Vector(4, 2);
        this.connections = [
            new Vector(0, 0),
            new Vector(this.size.x, -1),
            new Vector(this.size.x, 1),
        ];
        this.terminalLabels = ["Gate", "Drain", "Source"];
    }

    get type() {
        return "MOSFET";
    }

    getProperties() {
        return {
            ...super.getProperties(),

            Parameters: {
                "MOSFET Type": this.mosfetType,
                Vth: this.thresholdVoltage,
                K: this.transconductance,
                Lambda: this.channelLengthModulation,
            },

            ReadOnly: {
                Vgs: this.gateSourceVoltage,
                Vds: this.drainSourceVoltage,
                Id: this.drainCurrent,
            },
        };
    }

    setProperty(name, value) {
        super.setProperty(name, value);

        if (name === "Parameters.MOSFET Type") {
            const mosfetType = String(value).toLowerCase();
            if (MOSFET.types.includes(mosfetType)) {
                this.mosfetType = mosfetType;
            }
        }

        if (name === "Parameters.Vth") this.thresholdVoltage = Number(value);
        if (name === "Parameters.K") this.transconductance = Number(value);
        if (name === "Parameters.Lambda") {
            this.channelLengthModulation = Number(value);
        }
    }

    draw(ctx, zoom, pan) {
        if (!this.visible) return;

        super.draw(ctx, zoom, pan);

        const paths = [
            [new Vector(0, 0), new Vector(1, 0)],
            [new Vector(1, -0.8), new Vector(1, 0.8)],
            [new Vector(1.6, -0.8), new Vector(1.6, -0.3)],
            [new Vector(1.6, -0.2), new Vector(1.6, 0.2)],
            [new Vector(1.6, 0.3), new Vector(1.6, 0.8)],
            [
                new Vector(1.6, -0.65),
                new Vector(2.5, -0.65),
                new Vector(2.5, -1),
                new Vector(4, -1),
            ],
            [
                new Vector(1.6, 0.65),
                new Vector(2.5, 0.65),
                new Vector(2.5, 1),
                new Vector(4, 1),
            ],
            [new Vector(2.5, -0.65), new Vector(2.5, 0.65)],
        ];

        const arrowTipX = this.mosfetType === "nmos" ? 1.75 : 2.35;
        const arrowBaseX = this.mosfetType === "nmos" ? 2.3 : 1.8;
        paths.push(
            [new Vector(arrowBaseX, 0.3), new Vector(arrowTipX, 0.3)],
            [new Vector(arrowTipX, 0.3), new Vector(arrowBaseX, 0.05)],
            [new Vector(arrowTipX, 0.3), new Vector(arrowBaseX, 0.55)],
        );

        if (this.mosfetType === "pmos") {
            drawCircle(
                ctx,
                new Vector(1.3, 0),
                3,
                this.position,
                this.rotation,
                zoom,
                pan,
            );
        }

        for (const path of paths) {
            drawPath(ctx, path, this.position, this.rotation, zoom, pan);
        }

        this.drawTerminalLabels(ctx, zoom, pan);
    }
}

export class VoltageSource extends Component {
    constructor(name, position, rotation, layer, voltage) {
        super(name, position, rotation, layer);

        this.voltage = voltage;
        this.current = 0;
        this.size = new Vector(5, 2.5);
        this.connections = [new Vector(0, 0), new Vector(this.size.x, 0)];
    }

    get type() {
        return "VoltageSource";
    }

    getProperties() {
        return {
            ...super.getProperties(),

            Parameters: {
                V: this.voltage,
            },

            ReadOnly: {
                I: this.current,
            },
        };
    }

    setProperty(name, value) {
        super.setProperty(name, value);

        if (name === "Parameters.V") this.voltage = Number(value);
    }

    draw(ctx, zoom, pan) {
        if (!this.visible) return;

        super.draw(ctx, zoom, pan);

        const centre = new Vector(this.size.x / 2, 0);
        const radius = this.size.y / 2;

        drawPath(
            ctx,
            [
                new Vector(0, 0),
                new Vector(centre.x - radius, 0),
            ],
            this.position,
            this.rotation,
            zoom,
            pan,
        );
        drawPath(
            ctx,
            [
                new Vector(centre.x + radius, 0),
                new Vector(this.size.x, 0),
            ],
            this.position,
            this.rotation,
            zoom,
            pan,
        );
        drawCircle(
            ctx,
            centre,
            radius * gridSize,
            this.position,
            this.rotation,
            zoom,
            pan,
        );

        const signHalfSize = 0.3;
        const plusCentre = new Vector(0.45 + this.size.x/2,0);
        const minusCentre = new Vector(-0.45+ this.size.x/2,0);

        drawPath(
            ctx,
            [
                plusCentre.add(new Vector(-signHalfSize, 0)),
                plusCentre.add(new Vector(signHalfSize, 0)),
            ],
            this.position,
            this.rotation,
            zoom,
            pan,
        );
        drawPath(
            ctx,
            [
                plusCentre.add(new Vector(0, -signHalfSize)),
                plusCentre.add(new Vector(0, signHalfSize)),
            ],
            this.position,
            this.rotation,
            zoom,
            pan,
        );
        drawPath(
            ctx,
            [
                minusCentre.add(new Vector(-signHalfSize, 0)),
                minusCentre.add(new Vector(signHalfSize, 0)),
            ],
            this.position,
            this.rotation,
            zoom,
            pan,
        );
    }
}

export class CurrentSource extends Component {
    constructor(name, position, rotation, layer, current) {
        super(name, position, rotation, layer);

        this.current = current;
        this.potentialDifference = 0;
        this.size = new Vector(5, 2.5);
        this.connections = [new Vector(0, 0), new Vector(this.size.x, 0)];
    }

    get type() {
        return "CurrentSource";
    }

    getProperties() {
        return {
            ...super.getProperties(),

            Parameters: {
                I: this.current,
            },

            ReadOnly: {
                V: this.potentialDifference,
            },
        };
    }

    setProperty(name, value) {
        super.setProperty(name, value);

        if (name === "Parameters.I") this.current = Number(value);
    }

    draw(ctx, zoom, pan) {
        if (!this.visible) return;

        super.draw(ctx, zoom, pan);

        const centre = new Vector(this.size.x / 2, 0);
        const radius = this.size.y / 2;

        const paths = [
            [new Vector(0, 0), new Vector(centre.x - radius, 0)],
            [
                new Vector(centre.x + radius, 0),
                new Vector(this.size.x, 0),
            ],
            [new Vector(1.75, 0), new Vector(3.25, 0)],
            [new Vector(3.25, 0), new Vector(2.8, -0.4)],
            [new Vector(3.25, 0), new Vector(2.8, 0.4)],
        ];

        for (const path of paths) {
            drawPath(ctx, path, this.position, this.rotation, zoom, pan);
        }

        drawCircle(
            ctx,
            centre,
            radius * gridSize,
            this.position,
            this.rotation,
            zoom,
            pan,
        );
    }
}

export class SignalGenerator extends Component {
    static waveforms = ["sine", "saw", "square", "triangle", "pulse", "step"];
    static sourceTypes = ["voltage", "current", "fixed voltage"];

    constructor(
        name,
        position,
        rotation,
        layer,
        waveform = "sine",
        sourceType = "voltage",
    ) {
        super(name, position, rotation, layer);

        this.waveform = SignalGenerator.waveforms.includes(waveform)
            ? waveform
            : "sine";
        this.sourceType = SignalGenerator.sourceTypes.includes(sourceType)
            ? sourceType
            : "voltage";
        this.offset = 0;
        this.amplitude = 1;
        this.frequency = 1;
        this.phase = 0;
        this.high = 1;
        this.low = 0;
        this.dutyCycle = 50;
        this.delay = 0;
        this.riseTime = 0;
        this.fallTime = 0;
        this.width = 0.5;
        this.period = 1;
        this.initial = 0;
        this.final = 1;
        this.potentialDifference = 0;
        this.current = 0;
        this.size = new Vector(5, 2.5);
        this.updateSourceConnections();
    }

    get type() {
        return "SignalGenerator";
    }

    getWaveformProperties() {
        switch (this.waveform) {
            case "square":
                return {
                    Low: this.low,
                    High: this.high,
                    Frequency: this.frequency,
                    "Duty Cycle": this.dutyCycle,
                    Phase: this.phase,
                };
            case "pulse":
                return {
                    Low: this.low,
                    High: this.high,
                    Delay: this.delay,
                    "Rise Time": this.riseTime,
                    "Fall Time": this.fallTime,
                    Width: this.width,
                    Period: this.period,
                };
            case "step":
                return {
                    Initial: this.initial,
                    Final: this.final,
                    Delay: this.delay,
                    "Rise Time": this.riseTime,
                };
            default:
                return {
                    Offset: this.offset,
                    Amplitude: this.amplitude,
                    Frequency: this.frequency,
                    Phase: this.phase,
                };
        }
    }

    getProperties() {
        return {
            ...super.getProperties(),

            Parameters: {
                "Source Type": this.sourceType,
                Waveform: this.waveform,
                ...this.getWaveformProperties(),
            },

            ReadOnly: {
                V: this.potentialDifference,
                I: this.current,
            },
        };
    }

    setProperty(name, value) {
        super.setProperty(name, value);

        if (name === "Parameters.Source Type") {
            const sourceType = String(value).toLowerCase();
            if (SignalGenerator.sourceTypes.includes(sourceType)) {
                this.sourceType = sourceType;
                this.updateSourceConnections();
            }
            return;
        }

        if (name === "Parameters.Waveform") {
            const waveform = String(value).toLowerCase();
            if (SignalGenerator.waveforms.includes(waveform)) {
                this.waveform = waveform;
            }
            return;
        }

        const numericProperties = {
            "Parameters.Offset": "offset",
            "Parameters.Amplitude": "amplitude",
            "Parameters.Frequency": "frequency",
            "Parameters.Phase": "phase",
            "Parameters.High": "high",
            "Parameters.Low": "low",
            "Parameters.Duty Cycle": "dutyCycle",
            "Parameters.Delay": "delay",
            "Parameters.Rise Time": "riseTime",
            "Parameters.Fall Time": "fallTime",
            "Parameters.Width": "width",
            "Parameters.Period": "period",
            "Parameters.Initial": "initial",
            "Parameters.Final": "final",
        };
        const property = numericProperties[name];

        if (property) this[property] = Number(value);
    }

    updateSourceConnections() {
        this.connections = [new Vector(0, 0)];

        if (this.sourceType !== "fixed voltage") {
            this.connections.push(new Vector(this.size.x, 0));
        }
    }

    getWaveformPath() {
        const left = 1.7;
        const right = 3.3;
        const top = -0.55;
        const bottom = 0.55;
        const middle = 0;

        switch (this.waveform) {
            case "saw":
                return [
                    new Vector(left, bottom),
                    new Vector(2.45, top),
                    new Vector(2.45, bottom),
                    new Vector(right, top),
                ];
            case "square":
                return [
                    new Vector(left, bottom),
                    new Vector(2.05, bottom),
                    new Vector(2.05, top),
                    new Vector(2.8, top),
                    new Vector(2.8, bottom),
                    new Vector(right, bottom),
                ];
            case "triangle":
                return [
                    new Vector(left, bottom),
                    new Vector(2.1, top),
                    new Vector(2.5, bottom),
                    new Vector(2.9, top),
                    new Vector(right, bottom),
                ];
            case "pulse":
                return [
                    new Vector(left, bottom),
                    new Vector(2.2, bottom),
                    new Vector(2.2, top),
                    new Vector(2.75, top),
                    new Vector(2.75, bottom),
                    new Vector(right, bottom),
                ];
            case "step":
                return [
                    new Vector(left, bottom),
                    new Vector(2.5, bottom),
                    new Vector(2.5, top),
                    new Vector(right, top),
                ];
            default: {
                const path = [];
                const samples = 24;

                for (let i = 0; i <= samples; i++) {
                    const progress = i / samples;
                    path.push(
                        new Vector(
                            left + (right - left) * progress,
                            middle - Math.sin(progress * Math.PI * 2) * 0.55,
                        ),
                    );
                }

                return path;
            }
        }
    }

    draw(ctx, zoom, pan) {
        if (!this.visible) return;

        super.draw(ctx, zoom, pan);

        const centre = new Vector(this.size.x / 2, 0);
        const radius = this.size.y / 2;
        const paths = [
            [new Vector(0, 0), new Vector(centre.x - radius, 0)],
            this.getWaveformPath(),
        ];

        if (this.sourceType !== "fixed voltage") {
            paths.splice(1, 0, [
                new Vector(centre.x + radius, 0),
                new Vector(this.size.x, 0),
            ]);
        }

        for (const path of paths) {
            drawPath(ctx, path, this.position, this.rotation, zoom, pan);
        }

        drawCircle(
            ctx,
            centre,
            radius * gridSize,
            this.position,
            this.rotation,
            zoom,
            pan,
        );
    }
}

export class FixedVoltage extends Component {
    constructor(name, position, rotation, layer, voltage = 0) {
        super(name, position, rotation, layer);

        this.voltage = voltage;
        this.size = new Vector(3, 2);
        this.connections = [new Vector(0, 0)];
    }

    get type() {
        return "FixedVoltage";
    }

    getProperties() {
        return {
            ...super.getProperties(),

            Parameters: {
                V: this.voltage,
            },
        };
    }

    setProperty(name, value) {
        super.setProperty(name, value);

        if (name === "Parameters.V") this.voltage = Number(value);
    }

    draw(ctx, zoom, pan) {
        if (!this.visible) return;

        super.draw(ctx, zoom, pan);

        drawPath(
            ctx,
            [new Vector(0, 0), new Vector(1.5, 0)],
            this.position,
            this.rotation,
            zoom,
            pan,
        );

        const groundBars = [
            [new Vector(1.5, -1), new Vector(1.5, 1)],
            [new Vector(2, -0.65), new Vector(2, 0.65)],
            [new Vector(2.5, -0.3), new Vector(2.5, 0.3)],
        ];

        for (const bar of groundBars) {
            drawPath(ctx, bar, this.position, this.rotation, zoom, pan);
        }
    }
}

export class Reader extends Component {
    constructor(name, position, rotation, layer) {
        super(name, position, rotation, layer);

        this.potentialDifference = 0;
        this.current = 0;

        this.vs = []
        this.is = []
        this.size = new Vector(3, 2);
        this.connections = [new Vector(0, 0)];
    }

    get type() {
        return "Reader";
    }

    getProperties() {
        return {
            ...super.getProperties(),

            ReadOnly: {
                V: this.potentialDifference,
                I: this.current,
            },
        };
    }

    draw(ctx, zoom, pan) {
        if (!this.visible) return;

        super.draw(ctx, zoom, pan);

        const centre = new Vector(2, 0);
        const paths = [
            [new Vector(0, 0), new Vector(1, 0)],
            [centre, new Vector(2.55, -0.5)],
            [new Vector(1.45, 0.6), new Vector(2.55, 0.6)],
        ];

        for (const path of paths) {
            drawPath(ctx, path, this.position, this.rotation, zoom, pan);
        }

        drawCircle(
            ctx,
            centre,
            gridSize,
            this.position,
            this.rotation,
            zoom,
            pan,
        );
    }
}

export class Wire extends Component {
    constructor(start, end) {
        super("Wire", new Vector(start.x, start.y), 0);

        this.start = start;
        this.end = end;

        this.layer = Math.max(start.z, end.z);

        this.connections = [new Vector(0, 0), end.subtract(start).Vec2];
    }

    get type() {
        return "Wire";
    }

    getProperties() {
        return {
            Visible: this.visible,

            Start: {
                X: this.start.x,
                Y: this.start.y,
                Z: this.start.z,
            },

            End: {
                X: this.end.x,
                Y: this.end.y,
                Z: this.end.z,
            },
        };
    }

    updateConnections() {
        this.position = this.start.Vec2;
        this.connections[0] = new Vector(0, 0);
        this.connections[1] = this.end.subtract(this.start).Vec2;
        this.layer = Math.max(this.start.z, this.end.z);
    }

    isTerminalSelectable(terminal, lower, upper) {
        const layer = terminal === 1 ? this.start.z : this.end.z;
        return isSelectable(layer, lower, upper);
    }

    setProperty(name, value) {
        if (name === "Start.X") this.start.x = Number(value);

        if (name === "Start.Y") this.start.y = Number(value);
        if (name === "Start.Z") this.start.z = Number(value);

        if (name === "End.X") this.end.x = Number(value);

        if (name === "End.Y") this.end.y = Number(value);

        if (name === "End.Z") this.end.z = Number(value);
        if (name === "Visible") this.visible = parseBoolean(value);

        this.updateConnections();
    }

    onMouseMove(mouseGridPos, lower, upper) {
        this.selectedTerminal = 0;
        this.selected = false;
        if (
            !isSelectable(this.start.z, lower, upper) &&
            !isSelectable(this.end.z, lower, upper)
        ) {
            this.hovered = false;

            this.hoveredTerminal = 0;
            return;
        }

        if (!this.visible || !mouseGridPos) {
            this.hovered = false;

            this.hoveredTerminal = 0;
            return;
        }

        const start = this.start.Vec2;
        const end = this.end.Vec2;

        if (
            this.isTerminalSelectable(1, lower, upper) &&
            start.distance(mouseGridPos) <= 0.5
        ) {
            this.hovered = false;
            this.hoveredTerminal = 1;
            return;
        } else if (
            this.isTerminalSelectable(2, lower, upper) &&
            end.distance(mouseGridPos) <= 0.5
        ) {
            this.hovered = false;
            this.hoveredTerminal = 2;
            return;
        } else {
            this.hoveredTerminal = 0;
            this.selectedTerminal = 0;
        }

        // Moving the wire body moves both ends, so only allow it when both
        // endpoint layers are currently selectable.
        if (
            !this.isTerminalSelectable(1, lower, upper) ||
            !this.isTerminalSelectable(2, lower, upper)
        ) {
            this.hovered = false;
            return;
        }

        const segment = end.subtract(start);
        const segmentLengthSquared = segment.dot(segment);
        const hoverDistance = 0.25;

        if (segmentLengthSquared === 0) {
            this.hovered = mouseGridPos.distance(start) <= hoverDistance;
            return;
        }

        const point = mouseGridPos.subtract(start);
        const projection = point.dot(segment) / segmentLengthSquared;
        const t = Math.max(0, Math.min(1, projection));
        const closestPoint = start.add(segment.multiply(t));

        this.hovered = mouseGridPos.distance(closestPoint) <= hoverDistance;
    }

    drawTerminals(ctx, zoom, pan) {
        for (let terminal = 1; terminal <= this.connections.length; terminal++) {
            this.drawTerminal(ctx, terminal, zoom, pan);
        }
    }

    drawTerminal(ctx, terminal, zoom, pan) {
        if (!this.visible) return;

        const connection = this.connections[terminal - 1];
        if (!connection) return;

        const isSelected = terminal === this.selectedTerminal || this.selected;
        const isHovered = terminal === this.hoveredTerminal || this.hovered;

        ctx.lineWidth = 2;
        ctx.strokeStyle = "#e8e8e8";

        if (isHovered) {
            ctx.lineWidth = 3;
            ctx.strokeStyle = "#52a7ff";
        }

        if (isSelected) {
            ctx.lineWidth = 4;
            ctx.strokeStyle = "#ffb000";
        }

        ctx.fillStyle = ctx.strokeStyle;

        ctx.lineCap = "round";

        ctx.lineJoin = "round";
        drawCircle(
            ctx,
            connection,
            3,
            this.position,
            this.rotation,
            zoom,
            pan,
            true,
        );
    }

    draw(ctx, zoom, pan) {
        if (!this.visible) return;
        super.applyStyle(ctx);
        const path = [new Vector(0, 0), this.connections[1]];

        drawPath(ctx, path, this.position, 0, zoom, pan);
    }
}
