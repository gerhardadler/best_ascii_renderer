let img1;
let img2;
let img4;
let img8;
let shaderProgram;
let symbols = [];
let symbolTextures = [];
let numSymbols = 95; // Number of symbols to use

function preload() {
  img1 = loadImage("assets/watergirl.png");
  img2 = loadImage("assets/watergirl.png");
  img4 = loadImage("assets/watergirl.png");
  img8 = loadImage("assets/watergirl.png");
  font = loadFont("assets/font.otf");
  shaderProgram = loadShader("ascii.vert", "ascii.frag");
}

function setup() {
  img1.resize(img1.width - (img1.width % 8), img1.height - (img1.height % 8));
  img2.resize(img1.width / 2, img1.height / 2);
  img4.resize(img1.width / 4, img1.height / 4);
  img8.resize(img1.width / 8, img1.height / 8);
  createCanvas(img1.width, img1.height);
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

  numberInput = createInput();
  numberInput.attribute("type", "number");
  numberInput.attribute("min", "0"); // Minimum value
  numberInput.attribute("max", "255"); // Maximum value
  numberInput.position(10, height + 10); // Position on the canvas

  numberInput.value(0);

  // Create a button
  drawButton = createButton("Draw");
  drawButton.position(10, height + 50);

  // Attach a function to the button's click event
  drawButton.mousePressed(draw);

  pg = createGraphics(width, height, WEBGL);
}

function draw() {
  pg.shader(shaderProgram);
  shaderProgram.setUniform("img1", img1);
  shaderProgram.setUniform("img2", img2);
  shaderProgram.setUniform("img4", img4);
  shaderProgram.setUniform("img8", img8);
  shaderProgram.setUniform("atlas1", atlases[1]);
  shaderProgram.setUniform("atlas2", atlases[2]);
  shaderProgram.setUniform("atlas4", atlases[4]);
  shaderProgram.setUniform("atlas8", atlases[8]);
  shaderProgram.setUniform("scales", [1, 2, 4, 8]);
  shaderProgram.setUniform("scaleWeights", [10.0, 4.0, 8.0, 0.0]);
  shaderProgram.setUniform("numSymbols", numSymbols);
  shaderProgram.setUniform("resolution", [width, height]);
  pg.rect(-width / 2, -height / 2, width, height);
  pg.resetShader();
  image(pg, 0, 0);
  tint(255, 255, 255, parseFloat(numberInput.value()));
  image(img1, 0, 0);
}
