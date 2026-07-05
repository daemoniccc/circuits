import { Vector, Matrix } from "./maths";

export class Component {
    constructor(name, x, y) {
        this.name = name;
        this.position = new Vector(x, y);

        this.selected = false;
        this.visible = true;
    }

    get type() {
        return "Component";
    }

    draw(ctx) {
        throw new Error(`${this.type} has not implemented draw().`);
    }

    stamp(system, dt) {
        throw new Error(`${this.type} has not implemented stamp().`);
    }

    contains(point) {
        return false;
    }

    getProperties() {
        return {
            Name: this.name
        };
    }

    setProperty(name, value) {
        if (name === "Name") {
            this.name = value;
        }
    }
}

class Resistor extends Component {
    constructor(name, x, y, a, b, resistance) {
        super(name, x, y);

        this.a = a;
        this.b = b;

        this.resistance = resistance;
    }

    get type() {
        return "Resistor";
    }

    getProperties() {
        return {
            Name: this.name,

            Data: {
                NodeA: this.a,
                NodeB: this.b
            },

            Parameters: {
                Resistance: this.resistance
            }
        };
    }

    stamp(system, dt) {
        // Stamp resistor into MMNA matrix
    }

    draw(ctx) {
        // Draw resistor
    }
}

export class System {
    constructor(nodes, components) {
        
    }
}