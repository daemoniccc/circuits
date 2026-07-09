import { Vector } from "./maths.js";
import { Resistor, Wire } from "./canvasComponents.js";

const canvas = document.getElementById("circuit-canvas");
const ctx = canvas.getContext("2d");

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

function updateHoverStates() {
    let hoveredComponent = null;

    console.log(1)

    for (const component of components) {
        component.onMouseMove(mouseGridPosition);

        const isHovered = component.hovered || component.hoveredTerminal > 0;

        if (isHovered && !hoveredComponent) {
            hoveredComponent = component;
            continue;
        }

        component.hovered = false;
        component.selected = false;
        component.hoveredTerminal = 0;
        component.selectedTerminal = 0;
    }

    if (!hoveredComponent) return;

    console.log(hoveredComponent.selectedTerminal)

    if (isLMB) {
        hoveredComponent.selected = hoveredComponent.hovered;

        if (hoveredComponent.hoveredTerminal > 0) {
            hoveredComponent.selectedTerminal =
                hoveredComponent.hoveredTerminal;
        }
    }
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
        if (component.hovered || component.selected) {
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

    if (event.button === 0) isLMB = true;
    updateHoverStates();
    draw();

    if (event.button !== 2) return;

    event.preventDefault();
    isPanning = true;
    lastMousePosition = getCanvasPosition(event);
});

canvas.addEventListener("mousemove", (event) => {
    updateMouseGridPosition(event);
    updateHoverStates();

    if (!isPanning) {
        draw();
        return;
    }

    const mousePosition = getCanvasPosition(event);
    const delta = mousePosition.subtract(lastMousePosition);

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
resizeCanvas();
