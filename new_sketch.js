let charWidth;
let charHeight;
let widthInChars;
let heightInChars;

let asciiShaderProgram;
let renderShaderProgram;
let numSymbols = 95; // Number of symbols to use
const fontSize = 12;

let img;
let gl;
let shaderProgram;
let characterAtlasImage;

let canvas = document.getElementById("glCanvas");
let imageField = document.getElementById("image");
let widthInCharsField = document.getElementById("symbol-width");
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

imageField.addEventListener("change", function (event) {
  // Get the file from the input (first file in case of multiple)
  const file = event.target.files[0];

  if (file) {
    // Create a FileReader to read the file
    const reader = new FileReader();

    // When the file has been read, load it into an Image object
    reader.onload = function (e) {
      const loadingImage = new Image();
      loadingImage.src = e.target.result; // Use the result from the FileReader

      // Once the image is loaded, display it in the img tag
      loadingImage.onload = function () {
        img = loadingImage;
      };
    };

    // Read the image file as a data URL
    reader.readAsDataURL(file);
  }
});

function loadCustomFont(files) {
  const reader = new FileReader();
  reader.onload = (e) => {
    base64Font = e.target.result;
  };
  reader.readAsDataURL(files[0]);
}

// Convert SVG string to an Image object
function svgToImage(svgString) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgString], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = function () {
      URL.revokeObjectURL(url); // Release memory
      resolve(img);
    };
    img.onerror = reject;
    img.src = url;
  });
}

function loadImageFromURL(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = ""; // Enable CORS if necessary
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image from ${url}`));
    image.src = url;
  });
}

function createCharacterAtlas() {
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
    font-family: ${base64Font !== undefined ? "render-font" : "monospace"};
    font-variant-ligatures: none;`
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
  return [
    new XMLSerializer().serializeToString(svg),
    textBBox.width / chars.length,
    textBBox.height,
  ];
}

async function loadShaderFile(url) {
  const response = await fetch(url);
  return await response.text();
}

function compileShader(gl, sourceCode, type) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, sourceCode);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const error = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error("An error occurred compiling the shaders: " + error);
  }

  return shader;
}

async function initShaders(gl) {
  const vertexShaderSource = await loadShaderFile("ascii.vert");
  const fragmentShaderSource = await loadShaderFile("new_ascii.frag");

  const vertexShader = compileShader(gl, vertexShaderSource, gl.VERTEX_SHADER);
  const fragmentShader = compileShader(
    gl,
    fragmentShaderSource,
    gl.FRAGMENT_SHADER
  );

  const shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    throw new Error(
      "Unable to initialize the shader program: " +
        gl.getProgramInfoLog(shaderProgram)
    );
  }

  gl.useProgram(shaderProgram);

  return shaderProgram;
}

function loadTexture(gl, image) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

  // Generate mipmaps with 4 levels
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MIN_FILTER,
    gl.LINEAR_MIPMAP_LINEAR
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_BASE_LEVEL, 0);
  return texture;
}

async function setupWebGL() {
  gl = canvas.getContext("webgl2");
  gl.viewport(0, 0, widthInChars, heightInChars);
  shaderProgram = await initShaders(gl);

  const vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);

  const vertices = new Float32Array([
    -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0, -1.0,
  ]);

  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

  // Set up vertex attributes in WebGL2
  const positionAttributeLocation = gl.getAttribLocation(
    shaderProgram,
    "aVertexPosition"
  );
  gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(positionAttributeLocation);

  return [gl, shaderProgram];
}

function getOutputSVG(pixelData) {
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
    font-family: ${base64Font !== undefined ? "render-font" : "monospace"};
    font-variant-ligatures: none;`
  );

  for (let y = 0; y < heightInChars; y++) {
    let textLine = "";
    for (let x = 0; x < widthInChars; x++) {
      let index = (x + y * widthInChars) * 4;
      let r = pixelData[index] / 256;
      let g = pixelData[index + 1] / 256;
      let b = pixelData[index + 2] / 256;
      let a = pixelData[index + 3] / 256;

      let chosenSymbol =
        r + g / 256.0 + b / (256.0 * 256.0) + a / (256.0 * 256.0 * 256.0);
      let symbolIndex = Math.round(chosenSymbol * 95);
      textLine += chars.charAt(symbolIndex);
    }
    let svgText = document.createElementNS(svgNS, "text");
    svgText.setAttribute("x", 0);
    svgText.setAttribute("y", y * charHeight + charHeight); // Align text with the top
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

  return svg;
}

let prevImg;
let prevWidthInChars;
let prevBackground;
let prevForeground;
let prevBase64Font;

async function draw() {
  if (img === undefined) {
    return;
  }
  let setupRequired = false;
  if (
    prevWidthInChars !== widthInCharsField.value ||
    prevBackground !== characterBackgroundField.value ||
    prevForeground !== characterForegroundField.value ||
    prevBase64Font !== base64Font
  ) {
    let characterAtlas;
    [characterAtlas, charWidth, charHeight] = createCharacterAtlas();
    characterAtlasImage = await svgToImage(characterAtlas);
    setupRequired = true;
  }

  if (prevImg !== img) {
    setupRequired = true;
  }

  if (setupRequired) {
    console.log("Setting up WebGL");
    widthInChars = widthInCharsField.value;
    heightInChars =
      Math.round((img.height / img.width) * widthInChars) *
      (charWidth / charHeight);

    canvas.width = widthInChars;
    canvas.height = heightInChars;

    await setupWebGL();
  }

  // get the uniform locations
  const samplerUniformLocation = gl.getUniformLocation(shaderProgram, "img");
  const atlasSamplerUniformLocation = gl.getUniformLocation(
    shaderProgram,
    "atlas"
  );
  const scalesLocation = gl.getUniformLocation(shaderProgram, "scales");
  const scaleWeightsLocation = gl.getUniformLocation(
    shaderProgram,
    "scaleWeights"
  );
  const numSymbolsLocation = gl.getUniformLocation(shaderProgram, "numSymbols");
  const charSizeLocation = gl.getUniformLocation(shaderProgram, "charSize");
  const resolutionLocation = gl.getUniformLocation(shaderProgram, "resolution");
  const curveLocation = gl.getUniformLocation(shaderProgram, "curve");

  gl.activeTexture(gl.TEXTURE0);
  const texture = loadTexture(gl, img);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.uniform1i(samplerUniformLocation, 0);

  gl.activeTexture(gl.TEXTURE1);
  const atlasTexture = loadTexture(gl, characterAtlasImage);
  gl.bindTexture(gl.TEXTURE_2D, atlasTexture);
  gl.uniform1i(atlasSamplerUniformLocation, 1);

  // Pass the float arrays to the shader
  gl.uniform1fv(scalesLocation, [1, 2, 3, 4]);
  gl.uniform1fv(scaleWeightsLocation, [
    parseFloat(scaleWeight1.value),
    parseFloat(scaleWeight2.value),
    parseFloat(scaleWeight4.value),
    parseFloat(scaleWeight8.value),
  ]);

  gl.uniform1i(numSymbolsLocation, numSymbols);

  gl.uniform2fv(charSizeLocation, [charWidth, charHeight]);
  gl.uniform2fv(resolutionLocation, [widthInChars, heightInChars]);

  gl.uniform2fv(curveLocation, brightnessCurve.getPoints().flat());

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  const pixelData = new Uint8Array(widthInChars * heightInChars * 4); // 4 bytes per pixel

  // Read pixels from the WebGL canvas (bottom-left to top-right)
  gl.readPixels(
    0, // x coordinate
    0, // y coordinate (bottom-left corner)
    widthInChars, // width of the canvas
    heightInChars, // height of the canvas
    gl.RGBA, // format to read (RGBA)
    gl.UNSIGNED_BYTE, // type of data to read
    pixelData // typed array to store pixel data
  );

  const svg = getOutputSVG(pixelData, widthInChars, heightInChars, charHeight);
  document.getElementById("out").innerHTML = svg.outerHTML;
}

async function setup() {
  // const img = await loadImageFromURL("assets/dylan.png");
  // let characterAtlas;
  // [characterAtlas, charWidth, charHeight] = createCharacterAtlas();
  // const characterAtlasImage = await svgToImage(characterAtlas);
  // widthInChars = widthInCharsField.value;
  // heightInChars =
  //   Math.round((img.height / img.width) * widthInChars) *
  //   (charWidth / charHeight);
  // canvas.width = widthInChars;
  // canvas.height = heightInChars;
  // const [gl, shaderProgram] = await setupWebGL(canvas);
  // draw(gl, shaderProgram, img, characterAtlasImage);
}

window.addEventListener("load", setup, false);
drawButton.addEventListener("click", draw, false);
