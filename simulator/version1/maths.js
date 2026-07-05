// maths helper needed for the solver

export class Vector {
    constructor(...values) {
        this.values = [...values];
    }

    get length() {
        return this.values.length;
    }

    get type() {
        return 'Vector'
    }

    get x() {
        return this.values[0]
    }

    get y() {
        return this.values[1]
    }

    get z() {
        return this.values[2]
    }

    get Vec2() {
        return new Vector(this.values[0], this.values[1])
    }

    set x(value) {
        this.values[0] = value
    }

    set y(value) {
        this.values[1] = value
    }

    set z(value) {
        this.values[2] = value
    }

    copy() {
        return new Vector(...this.values);
    }

    add(other) {
        this.checkSize(other);
        return new Vector(
            ...this.values.map((v, i) => v + other.values[i])
        );
    }

    subtract(other) {
        this.checkSize(other);
        return new Vector(
            ...this.values.map((v, i) => v - other.values[i])
        );
    }

    multiply(scalar) {
        return new Vector(
            ...this.values.map(v => v * scalar)
        );
    }

    divide(scalar) {
        return new Vector(
            ...this.values.map(v => v / scalar)
        );
    }

    dot(other) {
        this.checkSize(other);

        let sum = 0;
        for (let i = 0; i < this.length; i++)
            sum += this.values[i] * other.values[i];

        return sum;
    }

    magnitude() {
        return Math.sqrt(this.dot(this));
    }

    normalize() {
        const mag = this.magnitude();
        return mag === 0 ? this.copy() : this.divide(mag);
    }

    distance(other) {
        return this.subtract(other).magnitude();
    }

    get(i) {
        return this.values[i];
    }

    set(i, value) {
        this.values[i] = value;
    }

    checkSize(other) {
        if (this.length !== other.length)
            throw new Error("Vector dimensions do not match.");
    }

    toString() {
        return `(${this.values.join(", ")})`;
    }

    withinBounds(upper, lower) {
        const dimensions = Math.min(this.length, upper.length, lower.length);

        for (let i = 0; i < dimensions; i++) {
            const min = Math.min(lower.get(i), upper.get(i));
            const max = Math.max(lower.get(i), upper.get(i));
            const value = this.get(i);

            if (value < min || value > max) return false;
        }

        return true;
    }
}

export class Matrix {
    constructor(rows) {
        this.rows = rows.map(row => [...row]);
    }

    get rowCount() {
        return this.rows.length;
    }

    get colCount() {
        return this.rows[0].length;
    }

    get type() {
        return 'Matrix'
    }

    get(r, c) {
        return this.rows[r][c];
    }

    set(r, c, value) {
        this.rows[r][c] = value;
    }

    copy() {
        return new Matrix(this.rows);
    }

    swapRows(a, b) {
        const temp = this.rows[a];
        this.rows[a] = this.rows[b];
        this.rows[b] = temp;
    }

    multiplyVector(vector) {
        if (this.colCount !== vector.length) {
            throw new Error("Matrix columns must match vector length.");
        }

        const result = [];

        for (let r = 0; r < this.rowCount; r++) {
            let sum = 0;

            for (let c = 0; c < this.colCount; c++) {
                sum += this.get(r, c) * vector.get(c);
            }

            result.push(sum);
        }

        return new Vector(...result);
    }

    static solve(A, b) {
        if (A.rowCount !== A.colCount) {
            throw new Error("Matrix must be square.");
        }

        if (A.rowCount !== b.length) {
            throw new Error("Matrix size must match vector size.");
        }

        const n = A.rowCount;
        const M = A.copy();
        const x = b.copy();

        for (let pivot = 0; pivot < n; pivot++) {
            let bestRow = pivot;

            for (let r = pivot + 1; r < n; r++) {
                if (Math.abs(M.get(r, pivot)) > Math.abs(M.get(bestRow, pivot))) {
                    bestRow = r;
                }
            }

            if (Math.abs(M.get(bestRow, pivot)) < 1e-12) {
                throw new Error("Matrix is singular or nearly singular.");
            }

            M.swapRows(pivot, bestRow);

            const temp = x.get(pivot);
            x.set(pivot, x.get(bestRow));
            x.set(bestRow, temp);

            for (let r = pivot + 1; r < n; r++) {
                const factor = M.get(r, pivot) / M.get(pivot, pivot);

                for (let c = pivot; c < n; c++) {
                    M.set(r, c, M.get(r, c) - factor * M.get(pivot, c));
                }

                x.set(r, x.get(r) - factor * x.get(pivot));
            }
        }

        // Back substitution
        const solution = new Array(n).fill(0);

        for (let r = n - 1; r >= 0; r--) {
            let sum = 0;

            for (let c = r + 1; c < n; c++) {
                sum += M.get(r, c) * solution[c];
            }

            solution[r] = (x.get(r) - sum) / M.get(r, r);
        }

        return new Vector(...solution);
    }

    toString() {
        return this.rows.map(row => `[${row.join(", ")}]`).join("\n");
    }
}
