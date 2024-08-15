let img1;
let img2;
let img4;
let img8;
let asciiShaderProgram;
let symbols = [];
let symbolTextures = [];
let numSymbols = 95; // Number of symbols to use
let origImgWidth;
let origImgHeight;

let symbolWidthField = document.getElementById("symbol-width");
let overlayOpacityField = document.getElementById("overlay-opacity");
let contrastField = document.getElementById("contrast");
let scaleWeight1 = document.getElementById("scale-weight-1");
let scaleWeight2 = document.getElementById("scale-weight-2");
let scaleWeight4 = document.getElementById("scale-weight-4");
let scaleWeight8 = document.getElementById("scale-weight-8");
let drawButton = document.getElementById("draw-button");

function preload() {
  img1 = loadImage("assets/dylan.png");
  img2 = loadImage("assets/dylan.png");
  img4 = loadImage("assets/dylan.png");
  img8 = loadImage("assets/dylan.png");
  font = loadFont("assets/font.otf");
  asciiShaderProgram = loadShader("ascii.vert", "ascii.frag");
  renderShaderProgram = loadShader("render.vert", "render.frag");
}

function setup() {
  origImgWidth = img1.width;
  origImgHeight = img1.height;
  drawButton.addEventListener("click", draw);
  noLoop();

  let chars =
    " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~"; // String containing all characters you want to use as symbols
  atlases = {
    1: createGraphics(numSymbols * 8, 16)
      .textFont(font)
      .textSize(12)
      .pixelDensity(1)
      .background(0, 0, 0, 255),
    2: createGraphics(numSymbols * 4, 8)
      .textFont(font)
      .textSize(6)
      .pixelDensity(1)
      .background(0, 0, 0, 255),
    4: createGraphics(numSymbols * 2, 4)
      .textFont(font)
      .textSize(3)
      .pixelDensity(1)
      .background(0, 0, 0, 255),
    8: createGraphics(numSymbols * 1, 2)
      .textFont(font)
      .textSize(1.5)
      .pixelDensity(1)
      .background(0, 0, 0, 255),
  };
  for (const atlasScale of [1, 2, 4, 8]) {
    for (let i = 0; i < numSymbols; i++) {
      let x = i * (8 / atlasScale);
      atlases[atlasScale].fill(255); // Black text
      atlases[atlasScale].text(chars[i], x, 12 / atlasScale); // Center the text
    }
  }
}

function draw() {
  let symbolWidth = parseFloat(symbolWidthField.value);
  let symbolHeight = Math.floor(
    (origImgHeight / origImgWidth) * (symbolWidth / 2)
  );

  img1.resize(symbolWidth * 8, symbolHeight * 16);
  img2.resize(symbolWidth * 4, symbolHeight * 8);
  img4.resize(symbolWidth * 2, symbolHeight * 4);
  img8.resize(symbolWidth * 1, symbolHeight * 2);
  createCanvas(symbolWidth * 8, symbolHeight * 16 + 100);

  pg = createGraphics(symbolWidth, symbolHeight, WEBGL);

  pg.shader(asciiShaderProgram);
  asciiShaderProgram.setUniform("img1", img1);
  asciiShaderProgram.setUniform("img2", img2);
  asciiShaderProgram.setUniform("img4", img4);
  asciiShaderProgram.setUniform("img8", img8);
  asciiShaderProgram.setUniform("atlas1", atlases[1]);
  asciiShaderProgram.setUniform("atlas2", atlases[2]);
  asciiShaderProgram.setUniform("atlas4", atlases[4]);
  asciiShaderProgram.setUniform("atlas8", atlases[8]);
  asciiShaderProgram.setUniform("scales", [1, 2, 4, 8]);
  asciiShaderProgram.setUniform("scaleWeights", [10.0, 100.0, 10.0, 0.0]);
  asciiShaderProgram.setUniform("numSymbols", numSymbols);
  asciiShaderProgram.setUniform("resolution", [symbolWidth, symbolHeight]);
  pg.rect(-symbolWidth / 2, -symbolHeight / 2, symbolWidth, symbolHeight);
  pg.resetShader();

  renderPg = createGraphics(img1.width, img1.height, WEBGL);

  renderPg.shader(renderShaderProgram);
  renderShaderProgram.setUniform("atlas", atlases[1]);
  renderShaderProgram.setUniform("chosenSymbols", pg);
  renderShaderProgram.setUniform("numSymbols", numSymbols);
  renderShaderProgram.setUniform("resolution", [symbolWidth, symbolHeight]);
  renderPg.rect(img1.width / 2, -img1.height / 2, img1.width, img1.height);
  renderPg.resetShader();

  image(pg, 0, 0);
  image(renderPg, 0, 100);
  tint(255, 255, 255, parseFloat(overlayOpacityField.value));
  image(img1, 0, 100);
}
