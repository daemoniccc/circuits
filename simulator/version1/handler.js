import { Vector } from "./maths.js";
import { Resistor, Wire } from "./canvasComponents.js";

const canvas = document.getElementById("circuit-canvas");
const ctx = canvas.getContext("2d");
const propertiesPanel = document.getElementById("properties-panel");

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

const components = [
    new Resistor("test", new Vector(4, 4), 0, 0, 5),
    new Wire(new Vector(0, 10, 0), new Vector(4, 4, 0)),
];

function resizeCanvas() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
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

        const input = document.createElement("input");
        input.value = formatPropertyValue(value);
        input.readOnly = path.startsWith("ReadOnly.");
        input.addEventListener("change", () => {
            if (!selectedComponent) return;

            selectedComponent.setProperty(path, input.value);
            updateHoverStates();
            draw();
            renderPropertiesPanel();
        });
        row.appendChild(input);

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
    propertiesPanel.appendChild(renderPropertyGroup(selectedComponent.getProperties()));
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
        component.onMouseMove(mouseGridPosition);

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
            selectedComponent.position = mouseGridPosition.round();
            selectedComponent.start = mouseGridPosition
                .vecPush(selectedComponent.start.z)
                .round();
            selectedComponent.connections[1] = selectedComponent.end.subtract(
                selectedComponent.start,
            ).Vec2;
        } else if (selectedTerminal === 2) {
            selectedComponent.end = mouseGridPosition
                .vecPush(selectedComponent.end.z)
                .round();
            selectedComponent.connections[1] = selectedComponent.end.subtract(
                selectedComponent.start,
            ).Vec2;
        } else {
            selectedComponent.position = mouseGridPosition
                .add(startedPickUpOffset)
                .round();
            selectedComponent.start = selectedComponent.position.vecPush(
                selectedComponent.start.z,
            );
            selectedComponent.end = selectedComponent.start.Vec2.vecPush(0).add(
                selectedComponent.connections[1].vecPush(selectedComponent.end.z),
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

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();

    let drawLast;

    for (const component of components) {
        component.draw(ctx, zoom, pan);
        if (component.hovered || component.selected || component.selectedTerminal > 0) {
            drawLast = component;
        }
    }

    if (drawLast) drawLast.draw(ctx, zoom, pan);

    drawMouseGridPosition();
}

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
            startedPickUpOffset = selectedComponent.position.subtract(mouseGridPosition);
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
