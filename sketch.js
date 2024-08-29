let img;

let imgs = {};
let atlases = {};
let origCharWidth;
let origCharHeight;
let charWidth;
let charHeight;

let asciiShaderProgram;
let renderShaderProgram;
let numSymbols = 95; // Number of symbols to use
const fontSize = 12;

let pg;
let renderPg;

let symbolWidthField = document.getElementById("symbol-width");
let characterForegroundField = document.getElementById("character-foreground");
let characterBackgroundField = document.getElementById("character-background");
let overlayOpacityField = document.getElementById("overlay-opacity");
let brightnessCurveSvg = document.getElementById("brightness-curve");
let brightnessCurve = new Curve(brightnessCurveSvg, [
  [0, 0],
  [1, 1],
]);

let scaleWeight1 = document.getElementById("scale-weight-1");
let scaleWeight2 = document.getElementById("scale-weight-2");
let scaleWeight4 = document.getElementById("scale-weight-4");
let scaleWeight8 = document.getElementById("scale-weight-8");
let drawButton = document.getElementById("draw-button");
let outputText = document.getElementById("out");

let chars =
  " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~"; // String containing all characters you want to use as symbols

let base64Font;

function loadCustomFont(files) {
  const reader = new FileReader();
  reader.onload = (e) => {
    base64Font = e.target.result;
  };
  reader.readAsDataURL(files[0]);
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function preload() {
  img = loadImage("assets/dylan.png");
  img.filter(GRAY);
  asciiShaderProgram = loadShader("ascii.vert", "ascii.frag");
  renderShaderProgram = loadShader("render.vert", "render.frag");
}

function setup() {
  createCanvas(0, 0);
  drawButton.addEventListener("click", draw);
  noLoop();
}

function createCharacterAtlases() {
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  const svgStyle = document.createElementNS(svgNS, "style");
  svgStyle.textContent = `@font-face {
    font-family: render-font;
    src: url('${base64Font}');
  }`;
  svg.appendChild(svgStyle);
  svg.setAttribute(
    "style",
    `background-color: ${characterBackgroundField.value};
    font-family: ${base64Font !== undefined ? "render-font" : "monospace"};`
  );

  const svgText = document.createElementNS(svgNS, "text");
  svgText.setAttribute("x", 0);
  svgText.setAttribute("y", fontSize); // Align text with the top
  svgText.setAttribute("fill", characterForegroundField.value);
  svgText.setAttribute("font-size", fontSize);
  svgText.innerHTML = chars.replaceAll(" ", "&nbsp;");
  svg.appendChild(svgText);

  document.body.appendChild(svg);
  const textBBox = svgText.getBBox();
  document.body.removeChild(svg);

  svg.setAttribute("width", textBBox.width);
  svg.setAttribute("height", textBBox.height);
  let svgData = new XMLSerializer().serializeToString(svg);

  let svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
  let url = URL.createObjectURL(svgBlob);

  loadImage(url, (img) => {
    origCharWidth = img.width / chars.length;
    origCharHeight = img.height;

    // This is done to get the different scales to make more sense. Char scale 8 should be about 1x2
    const scaleRatio = 16 / origCharHeight;

    charHeight = origCharHeight * scaleRatio;
    charWidth = origCharWidth * scaleRatio;
    img.width *= scaleRatio;
    img.height *= scaleRatio;

    atlases = {
      1: createImage(Math.floor(img.width), Math.floor(img.height)),
      2: createImage(Math.floor(img.width / 2), Math.floor(img.height / 2)),
      4: createImage(Math.floor(img.width / 4), Math.floor(img.height / 4)),
      8: createImage(Math.floor(img.width / 8), Math.floor(img.height / 8)),
    };
    for (const atlas of Object.values(atlases)) {
      atlas.copy(
        img,
        0,
        0,
        img.width,
        img.height,
        0,
        0,
        atlas.width,
        atlas.height
      );
    }
  });
}

function createNewContext(symbolWidth, symbolHeight) {
  resizeCanvas(symbolWidth * charWidth, symbolHeight * charHeight);
  imgs = {
    1: createImage(symbolWidth * charWidth, symbolHeight * charHeight),
    2: createImage(
      (symbolWidth * charWidth) / 2,
      (symbolHeight * charHeight) / 2
    ),
    4: createImage(
      (symbolWidth * charWidth) / 4,
      (symbolHeight * charHeight) / 4
    ),
    8: createImage(
      (symbolWidth * charWidth) / 8,
      (symbolHeight * charHeight) / 8
    ),
  };
  for (const sizedImg of Object.values(imgs)) {
    sizedImg.copy(
      img,
      0,
      0,
      img.width,
      img.height,
      0,
      0,
      sizedImg.width,
      sizedImg.height
    );
  }
  pg?.remove();
  pg = createGraphics(symbolWidth, symbolHeight, WEBGL);
  renderPg?.remove();
  renderPg = createGraphics(imgs[1].width, imgs[1].height, WEBGL);
}

let lastSymbolWidth;
let lastCharacterBackground;
let lastCharacterForeground;
let lastBase64Font;

function draw() {
  background(255, 255, 255);
  if (
    characterBackgroundField.value !== lastCharacterBackground ||
    characterForegroundField.value !== lastCharacterForeground ||
    base64Font !== lastBase64Font
  ) {
    createCharacterAtlases();
    atlases = {};
    lastCharacterBackground = characterBackgroundField.value;
    lastCharacterForeground = characterForegroundField.value;
    lastBase64Font = base64Font;
  }

  if (atlases[1] === undefined) {
    loop();
    return;
  }
  noLoop();

  let symbolWidth = parseInt(symbolWidthField.value);
  let symbolHeight = Math.floor(
    (img.height / img.width) * (symbolWidth / (charHeight / charWidth))
  );
  if (lastSymbolWidth !== symbolWidth) {
    createNewContext(symbolWidth, symbolHeight);
    console.log("Created new context");
    lastSymbolWidth = symbolWidth;
  }

  pg.reset();

  pg.background(255, 255, 255, 0);
  asciiShaderProgram = asciiShaderProgram.copyToContext(pg);
  pg.shader(asciiShaderProgram);
  asciiShaderProgram.setUniform("img1", imgs[1]);
  asciiShaderProgram.setUniform("img2", imgs[2]);
  asciiShaderProgram.setUniform("img4", imgs[4]);
  asciiShaderProgram.setUniform("img8", imgs[8]);
  asciiShaderProgram.setUniform("atlas1", atlases[1]);
  asciiShaderProgram.setUniform("atlas2", atlases[2]);
  asciiShaderProgram.setUniform("atlas4", atlases[4]);
  asciiShaderProgram.setUniform("atlas8", atlases[8]);
  asciiShaderProgram.setUniform("scales", [1, 2, 4, 8]);
  asciiShaderProgram.setUniform("scaleWeights", [
    parseFloat(scaleWeight1.value),
    parseFloat(scaleWeight2.value),
    parseFloat(scaleWeight4.value),
    parseFloat(scaleWeight8.value),
  ]);
  asciiShaderProgram.setUniform("numSymbols", numSymbols);
  asciiShaderProgram.setUniform("charSize", [charWidth, charHeight]);
  asciiShaderProgram.setUniform("resolution", [symbolWidth, symbolHeight]);
  console.log(brightnessCurve.getPoints());
  asciiShaderProgram.setUniform("curve", brightnessCurve.getPoints().flat());
  pg.rect(-symbolWidth / 2, -symbolHeight / 2, symbolWidth, symbolHeight);
  pg.resetShader();

  tint(255, 255, 255, parseFloat(overlayOpacityField.value));
  image(imgs[1], 0, 0);
  noTint();

  pg.loadPixels();

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  const svgStyle = document.createElementNS(svgNS, "style");
  svgStyle.textContent = `@font-face {
    font-family: render-font;
    src: url('${base64Font}');
  }`;
  svg.appendChild(svgStyle);
  svg.setAttribute(
    "style",
    `background-color: ${characterBackgroundField.value};
    white-space: pre;
    font-family: ${base64Font !== undefined ? "render-font" : "monospace"};`
  );

  for (let y = 0; y < pg.height; y++) {
    let textLine = "";
    for (let x = 0; x < pg.width; x++) {
      let index = (x + y * pg.width) * 4;
      let r = pg.pixels[index] / 256;
      let g = pg.pixels[index + 1] / 256;
      let b = pg.pixels[index + 2] / 256;
      let a = pg.pixels[index + 3] / 256;

      let chosenSymbol =
        r + g / 256.0 + b / (256.0 * 256.0) + a / (256.0 * 256.0 * 256.0);
      let symbolIndex = Math.round(chosenSymbol * 95);
      textLine += chars.charAt(symbolIndex);
    }
    let svgText = document.createElementNS(svgNS, "text");
    svgText.setAttribute("x", 0);
    svgText.setAttribute("y", y * origCharHeight + origCharHeight); // Align text with the top
    svgText.setAttribute("fill", characterForegroundField.value);
    svgText.setAttribute("font-size", fontSize);

    svgText.textContent = textLine + "\n";
    svg.appendChild(svgText);
  }

  document.body.appendChild(svg);
  const textBBox = svg.getBBox();
  document.body.removeChild(svg);

  svg.setAttribute("width", textBBox.width);
  svg.setAttribute("height", textBBox.height);

  document.getElementById("out").innerHTML = svg.outerHTML;
}
