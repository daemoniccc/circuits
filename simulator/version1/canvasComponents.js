import { Vector } from "./maths.js";

const gridSize = 10;

function worldToScreen(v, zoom, pan) {
    return new Vector(
        v.x * gridSize * zoom + pan.x,

        v.y * gridSize * zoom + pan.y,
    );
}

function rotatePoint(p, angle) {
    const c = Math.cos(angle);

    const s = Math.sin(angle);

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

export class Component {
    constructor(name, position, rotation, layer = 0) {
        this.name = name;
        this.position = position;
        this.connections = [];

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

    onMouseMove(mouseGridPos) {
        if (!this.visible || !mouseGridPos) {
            this.hovered = false;
            this.selected = false;
            this.hoveredTerminal = 0;
            return;
        }

        const relativeMousePos = mouseGridPos.subtract(this.position);
        const localMousePos = rotatePoint(relativeMousePos, -this.rotation);

        const upper = new Vector(this.size.x, this.size.y / 2);
        const lower = new Vector(0, -this.size.y / 2);

        this.hovered = localMousePos.withinBounds(upper, lower);
    }

    setProperty(name, value) {
        if (name === "Name") this.name = value;

        if (name === "Position.X") this.position.x = Number(value);

        if (name === "`Position.Y") this.position.y = Number(value);

        if (name === "Rotation") this.rotation = Number(value);

        if (name === "Layer") this.layer = Number(value);

        if (name === "Visible") this.visible = Boolean(value);
    }

    applyStyle(ctx) {
        if (this.selected) {
            ctx.lineWidth = 4
            ctx.strokeStyle = "#ffb000"
        } else if (this.hovered) {
            ctx.lineWidth = 3
            ctx.strokeStyle = "#52a7ff"
        } else {
            ctx.lineWidth = 2
            ctx.strokeStyle = '#e8e8e8'
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
            Parameters: {
                R: this.resistance,
            },

            ReadOnly: {
                V: this.potentialDifference,
                I: this.current,
            },
        }.concat(super.getProperties());
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

export class Wire extends Component {
    constructor(start, end) {
        super("Wire", new Vector(start.x, start.y), 0);

        this.start = start;
        this.end = end;

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

    setProperty(name, value) {
        if (name === "Start.X") {
            this.start.x = Number(value);
            this.position.x = Number(value);
        }

        if (name === "Start.Y") {
            this.start.y = Number(value);
            this.position.y = Number(value);
        }
        if (name === "Start.Z") this.start.z = Number(value);

        if (name === "End.X") this.end.x = Number(value);

        if (name === "End.Y") this.end.y = Number(value);

        if (name === "End.Z") this.end.z = Number(value);
        if (name === "Visible") this.visible = Boolean(value);
    }

    onMouseMove(mouseGridPos) {
        this.selectedTerminal = 0;
        this.selected = false;
        if (!this.visible || !mouseGridPos) {
            this.hovered = false;

            this.hoveredTerminal = 0;
            return;
        }

        const start = this.start.Vec2;
        const end = this.end.Vec2;

        if (start.distance(mouseGridPos) <= 0.5) {
            this.hovered = false;
            this.hoveredTerminal = 1;
            return;
        } else if (end.distance(mouseGridPos) <= 0.5) {
            this.hovered = false;
            this.hoveredTerminal = 2;
            return;
        } else {
            this.hoveredTerminal = 0;
            this.selectedTerminal = 0;
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
        let i = 1;
        for (const connection of this.connections) {
            const isSelected = i === this.selectedTerminal || this.selected;
            const isHovered = i === this.hoveredTerminal || this.hovered;

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
            i++;
        }
    }

    draw(ctx, zoom, pan) {
        if (!this.visible) return;

        super.applyStyle(ctx);
        const path = [
            new Vector(0, 0),
            new Vector(this.end.x - this.start.x, this.end.y - this.start.y),
        ];

        drawPath(ctx, path, this.position, 0, zoom, pan);

        this.drawTerminals(ctx, zoom, pan);
    }
}
