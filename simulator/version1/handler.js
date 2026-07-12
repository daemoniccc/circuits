import { Vector } from "./maths.js";
import {
    Capacitor,
    CurrentSource,
    FixedVoltage,
    Resistor,
    SignalGenerator,
    VoltageSource,
    Wire,
} from "./canvasComponents.js";

const canvas = document.getElementById("circuit-canvas");
const ctx = canvas.getContext("2d");
const propertiesPanel = document.getElementById("properties-panel");

const offscreen = document.createElement("canvas");
offscreen.width = canvas.width;
offscreen.height = canvas.height;

const offCtx = offscreen.getContext("2d");

const componentsPanel = document.getElementById("components-panel");
const layerFromInput = document.getElementById("layer-from");
const layerToInput = document.getElementById("layer-to");
const simulationTimeInput = document.getElementById("simulation-time");
const timeStepInput = document.getElementById("time-step");
const stepsPerSecondInput = document.getElementById("steps-per-second");
const simulationToggle = document.getElementById("simulation-toggle");

const minZoom = 0.2;
const maxZoom = 5;
const zoomStep = 1.05;
const gridSize = 10;

let zoom = 1;
let pan = new Vector(0, 0);
let isPanning = false;
let isLMB = false;
let lastMousePosition = new Vector(0, 0);
let mouseGridPosition = null;
let selectedComponent = null;
let selectedTerminal = 0;
let hoveredComponent = null;
let startedPickUpOffset = new Vector(0, 0);
let simulationPaused = false;
let simulationTime = 0;
let timeStep = 0.02;
let timeStepsPerSecond = 50;
let upperLayer = 100;
let lowerLayer = 0;

const components = [
    new Resistor("test", new Vector(4, 4), 0, 0, 5),
    new Wire(new Vector(0, 10, 0), new Vector(4, 4, 0)),
];

function opacity(layer) {
    if (layer <= upperLayer && layer >= lowerLayer) {
        return 1;
    } else if (layer < lowerLayer) {
        return (1 / (lowerLayer - layer + 1)) ** 2;
    } else if (layer > upperLayer) {
        return (1 / (layer - upperLayer + 1)) ** 2;
    }
}

function addComponent(name) {
    switch (name) {
        case "Wire":
            components.push(new Wire(new Vector(0, 0, 0), new Vector(3, 0, 0)));
            break;
        case "Resistor":
            components.push(
                new Resistor("Resistor", new Vector(0, 0), 0, 0, 100),
            );
            break;
        case "Capacitor":
            components.push(
                new Capacitor("Capacitor", new Vector(0, 0), 0, 0, 0.000001),
            );
            break;
        case "Voltage Source":
            components.push(
                new VoltageSource(
                    "Voltage Source",
                    new Vector(0, 0),
                    0,
                    0,
                    5,
                ),
            );
            break;
        case "Current Source":
            components.push(
                new CurrentSource(
                    "Current Source",
                    new Vector(0, 0),
                    0,
                    0,
                    1,
                ),
            );
            break;
        case "Signal Generator":
            components.push(
                new SignalGenerator(
                    "Signal Generator",
                    new Vector(0, 0),
                    0,
                    0,
                    "sine",
                ),
            );
            break;
        case "Fixed Voltage / Ground":
            components.push(
                new FixedVoltage("Ground", new Vector(0, 0), 0, 0, 0),
            );
            break;
    }
    draw();
}

function updateVisibleLayerRange(fromLayer, toLayer) {
    lowerLayer = fromLayer;
    upperLayer = toLayer;
    draw();
}

function setSimulationPaused(isPaused) {
    // TODO: Pause or start the circuit simulation.
}

function setSimulationTime(time) {
    simulationTime = time;
    // TODO: Move or reset the simulation to this time.
}

function setTimeStep(dt) {
    timeStep = dt;
    // TODO: Apply this dt to each simulation step.
}

function setTimeStepsPerSecond(stepsPerSecond) {
    timeStepsPerSecond = stepsPerSecond;
    // TODO: Apply this rate to the simulation loop.
}

function resizeCanvas() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    offscreen.width = canvas.width;
    offscreen.height = canvas.height;
    draw();
}

function getCanvasPosition(event) {
    const rect = canvas.getBoundingClientRect();

    return new Vector(event.clientX - rect.left, event.clientY - rect.top);
}

function canvasToGridPosition(position) {
    return new Vector(
        (position.x - pan.x) / (gridSize * zoom),
        (position.y - pan.y) / (gridSize * zoom),
    );
}

function updateMouseGridPosition(event) {
    mouseGridPosition = canvasToGridPosition(getCanvasPosition(event));
}

function formatPropertyValue(value) {
    if (typeof value === "number") return Number(value.toFixed(4)).toString();
    return String(value);
}

function renderPropertyGroup(properties, parentPath = "") {
    const fragment = document.createDocumentFragment();

    for (const [name, value] of Object.entries(properties)) {
        const path = parentPath ? `${parentPath}.${name}` : name;

        if (value && typeof value === "object" && !Array.isArray(value)) {
            const heading = document.createElement("h3");
            heading.textContent = name;
            fragment.appendChild(heading);
            fragment.appendChild(renderPropertyGroup(value, path));
            continue;
        }

        const row = document.createElement("div");
        row.className = "property-row";

        const label = document.createElement("label");
        label.textContent = path;
        row.appendChild(label);

        let control;

        if (
            path === "Parameters.Waveform" ||
            path === "Parameters.Source Type"
        ) {
            control = document.createElement("select");

            const choices =
                path === "Parameters.Waveform"
                    ? SignalGenerator.waveforms
                    : SignalGenerator.sourceTypes;

            for (const choice of choices) {
                const option = document.createElement("option");
                option.value = choice;
                option.textContent = choice[0].toUpperCase() + choice.slice(1);
                control.appendChild(option);
            }
        } else {
            control = document.createElement("input");
            control.readOnly = path.startsWith("ReadOnly.");
        }

        control.value = formatPropertyValue(value);
        control.addEventListener("change", () => {
            if (!selectedComponent) return;

            selectedComponent.setProperty(path, control.value);
            updateHoverStates();
            draw();
            renderPropertiesPanel();
        });
        row.appendChild(control);

        fragment.appendChild(row);
    }

    return fragment;
}

function renderPropertiesPanel() {
    propertiesPanel.replaceChildren();

    if (!selectedComponent) {
        const emptyMessage = document.createElement("p");
        emptyMessage.className = "empty-properties";
        emptyMessage.textContent = "Select a component to view its properties.";
        propertiesPanel.appendChild(emptyMessage);
        return;
    }

    const type = document.createElement("div");
    type.className = "component-type";
    type.textContent = selectedComponent.type;
    propertiesPanel.appendChild(type);
    propertiesPanel.appendChild(
        renderPropertyGroup(selectedComponent.getProperties()),
    );
}

function clearSelection() {
    for (const component of components) {
        component.selected = false;
        component.selectedTerminal = 0;
    }

    selectedComponent = null;
    selectedTerminal = 0;
    renderPropertiesPanel();
}

function applySelectionState() {
    for (const component of components) {
        if (component !== selectedComponent) {
            component.selected = false;
            component.selectedTerminal = 0;
        }
    }

    if (!selectedComponent) return;

    selectedComponent.selected = selectedTerminal === 0;
    selectedComponent.selectedTerminal = selectedTerminal;
}

function selectComponent(component, terminal = 0) {
    clearSelection();
    selectedComponent = component;
    selectedTerminal = terminal;
    applySelectionState();
    renderPropertiesPanel();
}

function updateHoverStates() {
    hoveredComponent = null;

    for (const component of components) {
        component.onMouseMove(mouseGridPosition, lowerLayer, upperLayer);

        const isHovered = component.hovered || component.hoveredTerminal > 0;

        if (isHovered && !hoveredComponent) {
            hoveredComponent = component;
            continue;
        }

        component.hovered = false;
        component.hoveredTerminal = 0;
    }

    applySelectionState();
    renderPropertiesPanel();
}

function moveSelectedComponent() {
    if (!selectedComponent || !mouseGridPosition) return;

    if (selectedComponent.type === "Wire") {
        if (selectedTerminal === 1) {
            if (
                !selectedComponent.isTerminalSelectable(
                    1,
                    lowerLayer,
                    upperLayer,
                )
            ) {
                return;
            }
            selectedComponent.position = mouseGridPosition.round();
            selectedComponent.start = mouseGridPosition
                .vecPush(selectedComponent.start.z)
                .round();
            selectedComponent.connections[1] = selectedComponent.end.subtract(
                selectedComponent.start,
            ).Vec2;
        } else if (selectedTerminal === 2) {
            if (
                !selectedComponent.isTerminalSelectable(
                    2,
                    lowerLayer,
                    upperLayer,
                )
            ) {
                return;
            }
            selectedComponent.end = mouseGridPosition
                .vecPush(selectedComponent.end.z)
                .round();
            selectedComponent.connections[1] = selectedComponent.end.subtract(
                selectedComponent.start,
            ).Vec2;
        } else {
            if (
                !selectedComponent.isTerminalSelectable(
                    1,
                    lowerLayer,
                    upperLayer,
                ) ||
                !selectedComponent.isTerminalSelectable(
                    2,
                    lowerLayer,
                    upperLayer,
                )
            ) {
                return;
            }
            selectedComponent.position = mouseGridPosition
                .add(startedPickUpOffset)
                .round();
            selectedComponent.start = selectedComponent.position.vecPush(
                selectedComponent.start.z,
            );
            selectedComponent.end = selectedComponent.start.Vec2.vecPush(0).add(
                selectedComponent.connections[1].vecPush(
                    selectedComponent.end.z,
                ),
            );
        }
    } else {
        selectedComponent.position = mouseGridPosition
            .add(startedPickUpOffset)
            .round();
    }

    applySelectionState();
}

function drawGrid() {
    const scaledGridSize = gridSize * zoom;
    const startX = ((pan.x % scaledGridSize) + scaledGridSize) % scaledGridSize;
    const startY = ((pan.y % scaledGridSize) + scaledGridSize) % scaledGridSize;

    ctx.fillStyle = "#0d0d0d";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.beginPath();
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 1;

    for (let x = startX; x <= canvas.width; x += scaledGridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
    }

    for (let y = startY; y <= canvas.height; y += scaledGridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
    }

    ctx.stroke();
}

function drawMouseGridPosition() {
    if (!mouseGridPosition) return;

    ctx.fillStyle = "#aaa";
    ctx.font = "13px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(
        `Grid: ${mouseGridPosition.x.toFixed(2)}, ${mouseGridPosition.y.toFixed(2)}`,
        10,
        10,
    );
}

function toLayers() {
    const layers = new Map();

    function getLayer(layer) {
        if (!layers.has(layer)) {
            layers.set(layer, { components: [], wireTerminals: [] });
        }

        return layers.get(layer);
    }

    for (const component of components) {
        getLayer(component.layer).components.push(component);

        if (component instanceof Wire) {
            getLayer(component.start.z).wireTerminals.push({
                component,
                terminal: 1,
            });
            getLayer(component.end.z).wireTerminals.push({
                component,
                terminal: 2,
            });
        }
    }

    return layers;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();

    const drawLast = [];
    const terminalsToDrawLast = [];

    const layers = [...toLayers().entries()].sort(
        ([layerA], [layerB]) => layerA - layerB,
    );

    for (const [layerNumber, layerContents] of layers) {
        offCtx.clearRect(0, 0, offscreen.width, offscreen.height);

        for (const component of layerContents.components) {
            if (
                component.hovered ||
                component.selected ||
                component.selectedTerminal > 0
            ) {
                drawLast.push(component);
            } else {
                component.draw(offCtx, zoom, pan);
            }
        }

        for (const { component, terminal } of layerContents.wireTerminals) {
            if (
                component.selected ||
                component.selectedTerminal === terminal ||
                component.hovered ||
                component.hoveredTerminal === terminal
            ) {
                terminalsToDrawLast.push({
                    component,
                    terminal,
                    layer: layerNumber,
                });
            } else {
                component.drawTerminal(offCtx, terminal, zoom, pan);
            }
        }

        ctx.save();
        ctx.globalAlpha = opacity(layerNumber);
        ctx.drawImage(offscreen, 0, 0);
        ctx.restore();
    }

    for (const component of drawLast) {
        component.draw(ctx, zoom, pan);
    }

    for (const { component, terminal, layer } of terminalsToDrawLast) {
        ctx.save();
        ctx.globalAlpha = opacity(layer);
        component.drawTerminal(ctx, terminal, zoom, pan);
        ctx.restore();
    }

    drawMouseGridPosition();
}

componentsPanel.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
        addComponent(button.textContent.trim());
    });
});

function handleLayerRangeChange() {
    updateVisibleLayerRange(
        Number(layerFromInput.value),
        Number(layerToInput.value),
    );
    clearSelection();
}

layerFromInput.addEventListener("input", handleLayerRangeChange);
layerToInput.addEventListener("input", handleLayerRangeChange);

simulationTimeInput.addEventListener("change", () => {
    setSimulationTime(Number(simulationTimeInput.value));
});

timeStepInput.addEventListener("change", () => {
    setTimeStep(Number(timeStepInput.value));
});

stepsPerSecondInput.addEventListener("change", () => {
    setTimeStepsPerSecond(Number(stepsPerSecondInput.value));
});

simulationToggle.addEventListener("click", () => {
    simulationPaused = !simulationPaused;
    simulationToggle.textContent = simulationPaused ? "Start" : "Pause";
    setSimulationPaused(simulationPaused);
});

window.addEventListener("keydown", (event) => {
    const target = event.target;
    const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target.isContentEditable;

    if (
        isTyping ||
        event.repeat ||
        event.key.toLowerCase() !== "r" ||
        !selectedComponent ||
        selectedComponent.type === "Wire"
    ) {
        return;
    }

    selectedComponent.rotation = (selectedComponent.rotation + 90) % 360;
    updateHoverStates();
    draw();
});

canvas.addEventListener("contextmenu", (event) => {
    event.preventDefault();
});

canvas.addEventListener("mousedown", (event) => {
    updateMouseGridPosition(event);
    updateHoverStates();

    if (event.button === 0) {
        isLMB = true;

        if (hoveredComponent) {
            selectComponent(hoveredComponent, hoveredComponent.hoveredTerminal);
            startedPickUpOffset =
                selectedComponent.position.subtract(mouseGridPosition);
        } else {
            clearSelection();
        }
    }

    draw();

    if (event.button !== 2) return;

    event.preventDefault();
    isPanning = true;
    lastMousePosition = getCanvasPosition(event);
});

canvas.addEventListener("mousemove", (event) => {
    updateMouseGridPosition(event);

    const mousePosition = getCanvasPosition(event);
    const delta = mousePosition.subtract(lastMousePosition);

    if (selectedComponent && isLMB) {
        moveSelectedComponent();
    } else {
        updateHoverStates();
    }

    if (!isPanning) {
        draw();
        return;
    }

    pan = pan.add(delta);
    lastMousePosition = mousePosition;
    mouseGridPosition = canvasToGridPosition(mousePosition);
    updateHoverStates();
    draw();
});

canvas.addEventListener("mouseup", (event) => {
    if (event.button === 0) isLMB = false;
    updateHoverStates();
    if (event.button === 2) isPanning = false;
    draw();
});

canvas.addEventListener("mouseleave", () => {
    isLMB = false;
    isPanning = false;
    mouseGridPosition = null;
    updateHoverStates();
    draw();
});

canvas.addEventListener("wheel", (event) => {
    event.preventDefault();

    const mousePosition = getCanvasPosition(event);
    mouseGridPosition = canvasToGridPosition(mousePosition);
    const nextZoom = Math.max(
        minZoom,
        Math.min(maxZoom, zoom * (event.deltaY < 0 ? zoomStep : 1 / zoomStep)),
    );

    const scale = nextZoom / zoom;

    pan = new Vector(
        mousePosition.x - (mousePosition.x - pan.x) * scale,
        mousePosition.y - (mousePosition.y - pan.y) * scale,
    );

    zoom = nextZoom;
    mouseGridPosition = canvasToGridPosition(mousePosition);
    updateHoverStates();
    draw();
});

window.addEventListener("resize", resizeCanvas);
renderPropertiesPanel();
resizeCanvas();
