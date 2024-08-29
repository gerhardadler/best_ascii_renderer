class Point {
  constructor(x, y, getSvgRect) {
    this.x = x;
    this.y = y;
    this.getSvgRect = getSvgRect;
  }

  get actualX() {
    return this.x * this.getSvgRect().width;
  }
  get actualY() {
    return this.getSvgRect().height - this.y * this.getSvgRect().height;
  }

  static fromActual(x, y, getSvgRect) {
    return new Point(
      x / getSvgRect().width,
      1 - y / getSvgRect().height,
      getSvgRect
    );
  }
}

class Curves {
  constructor(
    svg,
    initialPoints,
    pathStyle = "fill:none;stroke:black;stroke-width:3",
    circleStyle = "fill:black;",
    circleRadius = 10
  ) {
    this.svg = svg;
    this.pathStyle = pathStyle;
    this.circleStyle = circleStyle;
    this.circleRadius = circleRadius;

    this.boundOnMouseDown = this.onMouseDown.bind(this);
    this.boundOnMouseMove = this.onMouseMove.bind(this);

    this.svg.addEventListener("mousedown", this.boundOnMouseDown);
    this.svg.addEventListener("mousemove", this.boundOnMouseMove);

    this.points = initialPoints.map(
      ([x, y]) => new Point(x, y, this.getBoundSvgRect())
    );

    this.closestPoint = new Point(0, 0, this.getBoundSvgRect());
    this.closestPointIndex = 0;
    this.selectedPoint = null;
    this.selectedPointIndex = null;

    this.update();
  }

  getMousePosition(e) {
    return Point.fromActual(
      e.clientX - this.getSvgRect().left,
      e.clientY - this.getSvgRect().top,
      this.getBoundSvgRect()
    );
  }

  getSvgRect() {
    return this.svg.getBoundingClientRect();
  }

  getBoundSvgRect() {
    return this.getSvgRect.bind(this);
  }

  update() {
    this.points.sort((pointA, pointB) => pointA.x > pointB.x);
    this.drawCircles();
    this.drawPath();
  }

  getPoints() {
    const listPrefix =
      this.points[0].x !== 0
        ? [new Point(0, this.points[0].y, this.getBoundSvgRect())]
        : [];
    const listSuffix =
      this.points[this.points.length - 1].x !== 1
        ? [
            new Point(
              1,
              this.points[this.points.length - 1].y,
              this.getBoundSvgRect()
            ),
          ]
        : [];
    return listPrefix
      .concat(this.points, listSuffix)
      .map((point) => [point.x, point.y]);
  }

  drawCircles() {
    this.svg.querySelectorAll("circle").forEach((circle) => circle.remove());
    this.points.forEach((point) => {
      const newCircle = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle"
      );
      newCircle.setAttribute("cx", point.actualX);
      newCircle.setAttribute("cy", point.actualY);
      newCircle.setAttribute("r", this.circleRadius);
      newCircle.setAttribute("style", this.circleStyle);
      this.svg.appendChild(newCircle);
    });
  }
  drawPath() {
    let path = this.svg.querySelector("path");
    if (!path) {
      path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("style", this.pathStyle);
      this.svg.prepend(path);
    }
    let d = `M ${0} ${this.points[0].actualY} `;
    this.points.forEach((point) => {
      d += `L ${parseFloat(point.actualX)} ${parseFloat(point.actualY)} `;
    });
    d += `L ${this.getSvgRect().width} ${
      this.points[this.points.length - 1].actualY
    }`;
    path.setAttribute("d", d);
  }

  onMouseMove(e) {
    const mousePosition = this.getMousePosition(e);
    let closestDistance = Infinity;

    this.points.forEach((point, i) => {
      // Calculate the distance from the target point
      const distance = Math.sqrt(
        Math.pow(point.x - mousePosition.x, 2) +
          Math.pow(point.y - mousePosition.y, 2)
      );

      // Check if this point is closer than the previous closest
      if (distance < closestDistance) {
        closestDistance = distance;
        this.closestPoint = point;
        this.closestPointIndex = i;
      }
    });

    if (
      Math.abs(this.closestPoint.x - mousePosition.x) < 0.03 &&
      Math.abs(this.closestPoint.y - mousePosition.y) < 0.03
    ) {
      this.svg.style.cursor = "move";
      this.selectedPoint = this.closestPoint;
      this.selectedPointIndex = this.closestPointIndex;
    } else {
      this.svg.style.cursor = "crosshair";
      this.selectedPoint = null;
      this.selectedPointIndex = null;
    }
  }
  onMouseDown(e) {
    if (this.selectedPoint !== null) {
      if (e.shiftKey) {
        this.points.splice(this.selectedPointIndex, 1);
        this.update();
        return;
      }
      const prevX = this.points[this.selectedPointIndex - 1]?.x ?? 0;
      const nextX =
        this.points[this.selectedPointIndex + 1]?.x ??
        this.getSvgRect().width / this.getSvgRect().width;
      const onMouseMove = (e) => {
        const mousePosition = this.getMousePosition(e);

        mousePosition.x = Math.max(prevX, Math.min(nextX, mousePosition.x));
        mousePosition.y = Math.max(
          0,
          Math.min(
            this.getSvgRect().height / this.getSvgRect().height,
            mousePosition.y
          )
        );

        this.points[this.selectedPointIndex] = mousePosition;
        this.update();
      };
      const onMouseUp = () => {
        window.removeEventListener("mousemove", onMouseMove);
        this.svg.addEventListener("mousemove", this.boundOnMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };
      this.svg.removeEventListener("mousemove", this.boundOnMouseMove);
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    } else {
      const mousePosition = this.getMousePosition(e);

      this.points.push(mousePosition);
      this.update();
    }
  }
}
