let charWidth;
let charHeight;
let fontSize = 12;
let atlasWidth;
let atlasHeight;

let widthInChars;
let heightInChars;

let img;
let gl;
let shaderProgram;
let characterAtlasImage;

const maxCharacterAtlasWidth = 95;
const imageField = document.getElementById("image");
const widthInCharsField = document.getElementById("symbol-width");
const lineHeightField = document.getElementById("line-height");
const charsField = document.getElementById("chars");
const brightnessCurveSvg = document.getElementById("brightness-curve");
const brightnessCurve = new Curve(brightnessCurveSvg, [
  [0, 0],
  [1, 0.3],
]);

const scaleWeight1 = document.getElementById("scale-weight-1");
const scaleWeight2 = document.getElementById("scale-weight-2");
const scaleWeight4 = document.getElementById("scale-weight-4");
const scaleWeight8 = document.getElementById("scale-weight-8");
const drawButton = document.getElementById("draw-button");
const outputText = document.getElementById("out");
const fontNameField = document.getElementById("font-name");
const fontWeightField = document.getElementById("font-weight");

const backgroundColorField = document.getElementById("background-color");

const addCustomColorButton = document.getElementById("add-custom-color-button");
const colorInput = document.getElementById("custom-color");
const colorListElement = document.getElementById("color-list");

const canvas = document.createElement("canvas");

const zoomInButton = document.getElementById("zoom-in");
const zoomOutButton = document.getElementById("zoom-out");

let zoom = 1;

zoomInButton.addEventListener("click", function () {
  zoom += 0.1;
  outputText.querySelector("svg").style.transform = `scale(${zoom})`;
});

zoomOutButton.addEventListener("click", function () {
  zoom -= 0.1;
  outputText.querySelector("svg").style.transform = `scale(${zoom})`;
});

const foregroundColorList = ["#FFFFFF"];

function renderColorList() {
  colorListElement.innerHTML = "";

  function renderColorListItem(color, deleteCallback) {
    const colorBox = document.createElement("div");
    colorBox.style.backgroundColor = color;
    colorBox.style.width = "20px";
    colorBox.style.height = "20px";
    colorBox.style.display = "inline-block";
    colorBox.style.border = "1px solid black";

    const listItem = document.createElement("li");
    listItem.textContent = `${color}`;

    const deleteButton = document.createElement("button");
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", function () {
      deleteCallback();
      renderColorList();
    });

    listItem.appendChild(colorBox);
    listItem.appendChild(deleteButton);
    colorListElement.appendChild(listItem);
  }

  foregroundColorList.forEach((color) => {
    renderColorListItem(color, function () {
      const index = foregroundColorList.indexOf(color);
      foregroundColorList.splice(index, 1);
    });
  });
}

renderColorList();

addCustomColorButton.addEventListener("click", function () {
  const color = colorInput.value;

  if (foregroundColorList.some((item) => item === color)) {
    return;
  }

  foregroundColorList.push(color);

  renderColorList();
});

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

function getCharacterColorList() {
  const characterColorList = [];
  foregroundColorList.forEach((foregroundColor) => {
    charsField.value.split("").forEach((character) => {
      characterColorList.push({
        foregroundColor,
        character,
      });
    });
  });
  return characterColorList;
}

function getFontStyle() {
  return `white-space: pre;
    font-family: ${fontNameField.value};
    font-weight: ${fontWeightField.value};
    font-variant-ligatures: none;`;
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

function measureCharacterWidth(char, fontSize) {
  let svgNS = "http://www.w3.org/2000/svg";
  let tempSvg = document.createElementNS(svgNS, "svg");
  tempSvg.setAttribute("style", getFontStyle());
  let tempText = document.createElementNS(svgNS, "text");
  tempText.setAttribute("font-size", fontSize);
  tempText.textContent = char;
  tempSvg.appendChild(tempText);
  document.body.appendChild(tempSvg);
  let bbox = tempText.getBBox();
  document.body.removeChild(tempSvg);
  return [bbox.width, bbox.height];
}

async function createCharacterAtlas() {
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");

  svg.setAttribute(
    "style",
    getFontStyle() + `background: ${backgroundColorField.value};`
  );
  // Measure character width
  let [initialCharWidth, initialCharHeight] = measureCharacterWidth(
    "M",
    fontSize
  );
  let fontWidth = 8;
  let charWidthScale = fontWidth / initialCharWidth;
  let adjustedCharHeight = initialCharHeight * charWidthScale;
  fontSize *= charWidthScale;

  let calculatedLineHeight = Math.round(
    adjustedCharHeight * lineHeightField.value
  );

  let characterColorList = getCharacterColorList();

  for (let i = 0; i < characterColorList.length; i++) {
    const characterColor = characterColorList[i];

    let y = Math.floor(i / maxCharacterAtlasWidth);
    let x = i % maxCharacterAtlasWidth;

    let textElem = document.createElementNS(svgNS, "text");
    textElem.setAttribute("x", x * 3 * fontWidth);
    textElem.setAttribute("y", fontSize + y * 3 * calculatedLineHeight);
    textElem.setAttribute("fill", characterColor.foregroundColor);

    textElem.setAttribute("font-size", `${fontSize}px`);
    textElem.textContent = characterColor.character;
    svg.appendChild(textElem);
  }

  // Set overall SVG dimensions
  atlasWidth = maxCharacterAtlasWidth;
  atlasHeight = Math.ceil(characterColorList.length / maxCharacterAtlasWidth);

  svg.setAttribute("width", fontWidth * atlasWidth * 3);
  svg.setAttribute("height", calculatedLineHeight * atlasHeight * 3);

  let serializedSvg = new XMLSerializer().serializeToString(svg);

  characterAtlasImage = await svgToImage(serializedSvg);
  charWidth = characterAtlasImage.width / atlasWidth / 3;
  charHeight = characterAtlasImage.height / atlasHeight / 3;
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
  const fragmentShaderSource = await loadShaderFile("new_ascii_new.frag");

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

  // Manually generate mipmaps
  let width = image.width;
  let height = image.height;
  let level = 1;

  // Loop until the texture is 1x1
  while (width > 1 || height > 1) {
    width = Math.max(1, width >> 1); // Divide width by 2
    height = Math.max(1, height >> 1); // Divide height by 2

    // Create a smaller canvas to render the mipmap level
    const mipmapCanvas = document.createElement("canvas");
    mipmapCanvas.width = width;
    mipmapCanvas.height = height;

    const ctx = mipmapCanvas.getContext("2d");
    ctx.drawImage(image, 0, 0, width, height);

    // Upload the mipmap level
    gl.texImage2D(
      gl.TEXTURE_2D,
      level,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      mipmapCanvas
    );

    level++;
  }
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
  svg.setAttribute("style", getFontStyle());

  let characterColorList = getCharacterColorList();

  let svgText = document.createElementNS(svgNS, "text");
  svgText.setAttribute("x", 0);
  svgText.setAttribute("y", 0);
  svgText.setAttribute("style", getFontStyle());
  svgText.setAttribute("font-size", fontSize);
  svgText.setAttribute("xml:space", "preserve");

  for (let y = 0; y < heightInChars; y++) {
    let wrapperTspan = document.createElementNS(svgNS, "tspan");
    wrapperTspan.setAttribute("x", 0);
    wrapperTspan.setAttribute("y", y * charHeight + charHeight);

    let currentColor = undefined;
    let sameColoredText = "";
    for (let x = 0; x < widthInChars; x++) {
      let index = (x + y * widthInChars) * 4;
      let r = pixelData[index];
      let g = pixelData[index + 1];
      let b = pixelData[index + 2];
      let a = pixelData[index + 3];

      let symbolIndex = r + (g << 8) + (b << 16) + (a << 24);
      let characterColor = characterColorList[symbolIndex];

      if (
        currentColor === characterColor.foregroundColor ||
        currentColor === undefined
      ) {
        sameColoredText += characterColor.character;
        currentColor = characterColor.foregroundColor;
        continue;
      }

      let lineContent = document.createElementNS(svgNS, "tspan");
      lineContent.setAttribute("fill", currentColor);
      lineContent.textContent = sameColoredText;
      wrapperTspan.appendChild(lineContent);

      sameColoredText = characterColor.character;
      currentColor = characterColor.foregroundColor;
      // lineContent += `<tspan fill="${characterColor.foregroundColor}">${characterColor.character}</tspan>`;
    }
    let lineContent = document.createElementNS(svgNS, "tspan");
    lineContent.setAttribute("fill", currentColor);
    lineContent.textContent = sameColoredText + "\n";
    wrapperTspan.appendChild(lineContent);

    svgText.appendChild(wrapperTspan);
  }

  svg.appendChild(svgText);

  document.body.appendChild(svg);
  const textBBox = svg.getBBox();
  document.body.removeChild(svg);

  const backgroundRect = document.createElementNS(svgNS, "rect");
  backgroundRect.setAttribute("x", textBBox.x);
  backgroundRect.setAttribute("y", textBBox.y);
  backgroundRect.setAttribute("width", textBBox.width);
  backgroundRect.setAttribute("height", textBBox.height);
  backgroundRect.setAttribute("fill", backgroundColorField.value);
  svg.insertBefore(backgroundRect, svg.firstChild);

  svg.setAttribute("width", textBBox.width);
  svg.setAttribute("height", textBBox.height);

  return svg;
}

let prevImg;
let prevWidthInChars;
let prevChars;
let prevBackgroundColorList;
let prevForegroundColorList;
let prevLineHeight;
let prevFontName;
let prevFontWeight;

async function draw() {
  if (img === undefined) {
    return;
  }
  let setupRequired = false;
  if (
    prevWidthInChars !== widthInCharsField.value ||
    prevChars !== charsField.value ||
    !prevForegroundColorList.every((v, i) => v === foregroundColorList[i]) ||
    prevLineHeight !== lineHeightField.value ||
    prevFontName !== fontNameField.value ||
    prevFontWeight !== fontWeightField.value
  ) {
    await createCharacterAtlas();
    setupRequired = true;
    prevWidthInChars = widthInCharsField.value;
    prevChars = charsField.value;
    prevForegroundColorList = Array.from(foregroundColorList);
    prevLineHeight = lineHeightField.value;
    prevFontName = fontNameField.value;
    prevFontWeight = fontWeightField.value;
  }

  if (prevImg !== img) {
    setupRequired = true;
    prevImg = img;
  }

  setupRequired = true;

  if (setupRequired) {
    console.log("Setting up WebGL");
    widthInChars = widthInCharsField.value;
    heightInChars = Math.round(
      (img.height / img.width) * widthInChars * (charWidth / charHeight)
    );

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
  const atlasWidthLocation = gl.getUniformLocation(shaderProgram, "atlasWidth");
  const atlasHeightLocation = gl.getUniformLocation(
    shaderProgram,
    "atlasHeight"
  );
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
  gl.uniform1fv(scalesLocation, [0, 1, 2, 3]);
  gl.uniform1fv(scaleWeightsLocation, [
    parseFloat(scaleWeight1.value),
    parseFloat(scaleWeight2.value),
    parseFloat(scaleWeight4.value),
    parseFloat(scaleWeight8.value),
  ]);

  let characterColorList = getCharacterColorList();
  console.log(characterColorList.length);
  console.log(charsField.value);
  gl.uniform1i(numSymbolsLocation, characterColorList.length);
  gl.uniform1i(atlasWidthLocation, atlasWidth);
  gl.uniform1i(atlasHeightLocation, atlasHeight);

  console.log(charWidth, charHeight);

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
  document.getElementById("out").innerHTML = "";
  document.getElementById("out").appendChild(svg);
}

drawButton.addEventListener("click", draw, false);
