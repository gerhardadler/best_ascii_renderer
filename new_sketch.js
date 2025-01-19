let charWidth;
let charHeight;
let fontSize = 12;
let atlasWidth;
let atlasHeight;

let widthInChars;
let heightInChars;

let img;
let gl;
let asciiShaderProgram;
let preprocessShaderProgram;
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
const brightness = document.getElementById("brightness");
const contrast = document.getElementById("contrast");
const saturation = document.getElementById("saturation");

const scaleWeight1 = document.getElementById("scale-weight-1");
const scaleWeight2 = document.getElementById("scale-weight-2");
const scaleWeight4 = document.getElementById("scale-weight-4");
const scaleWeight8 = document.getElementById("scale-weight-8");
const drawButton = document.getElementById("draw-button");
const svgContainer = document.getElementById("svg-container");
const fontNameField = document.getElementById("font-name");
const fontWeightField = document.getElementById("font-weight");

const backgroundColorField = document.getElementById("background-color");

const addCustomColorButton = document.getElementById("add-custom-color-button");
const colorInput = document.getElementById("custom-color");
const colorListElement = document.getElementById("color-list");

// const canvas = document.createElement("canvas");
const canvas = document.getElementById("canvas");

const zoomInButton = document.getElementById("zoom-in");
const zoomOutButton = document.getElementById("zoom-out");

const pngWidthField = document.getElementById("png-width");
const downloadPngButton = document.getElementById("download-png-button");
const downloadSvgButton = document.getElementById("download-svg-button");

let zoom = 1;

zoomInButton.addEventListener("click", function () {
  zoom += 0.1;
  svgContainer.style.transform = `scale(${zoom})`;
});

zoomOutButton.addEventListener("click", function () {
  zoom -= 0.1;
  svgContainer.style.transform = `scale(${zoom})`;
});

downloadPngButton.addEventListener("click", async function () {
  const svg = svgContainer.querySelector("svg");
  const svgImage = await svgToImage(new XMLSerializer().serializeToString(svg));

  // create a canvas element to render the SVG to. remember to set the dimensions.
  const canvas = document.createElement("canvas");
  canvas.width = parseInt(pngWidthField.value);
  console.log(pngWidthField.value);
  console.log(svg.width.baseVal.value);
  console.log(svg.height.baseVal.value);
  canvas.height =
    (parseInt(pngWidthField.value) / svg.width.baseVal.value) *
    svg.height.baseVal.value;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(svgImage, 0, 0, canvas.width, canvas.height);

  // create a blob from the canvas
  canvas.toBlob((blob) => {
    // create an anchor element
    url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "output.png";
    a.click();

    URL.revokeObjectURL(url);
  });
});

downloadSvgButton.addEventListener("click", function () {
  const svg = svgContainer.querySelector("svg");
  const svgString = new XMLSerializer().serializeToString(svg);
  const blob = new Blob([svgString], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "output.svg";
  anchor.click();
  URL.revokeObjectURL(url);
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

async function initShaders(gl, vertexShaderSource, fragmentShaderSource) {
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

  return shaderProgram;
}

function createTexture(gl, image = null, width = 0, height = 0) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);

  if (image) {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  } else {
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null
    );
  }

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  if (image !== null) {
    // Manually generate mipmaps
    let mipMapWidth = image.width;
    let mipMapHeight = image.height;
    let level = 1;

    // Loop until the texture is 1x1
    while (mipMapWidth > 1 || mipMapHeight > 1) {
      mipMapWidth = Math.max(1, mipMapWidth >> 1); // Divide width by 2
      mipMapHeight = Math.max(1, mipMapHeight >> 1); // Divide height by 2

      // Create a smaller canvas to render the mipmap level
      const mipmapCanvas = document.createElement("canvas");
      mipmapCanvas.width = mipMapWidth;
      mipmapCanvas.height = mipMapHeight;

      const ctx = mipmapCanvas.getContext("2d");
      ctx.drawImage(image, 0, 0, mipMapWidth, mipMapHeight);

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
  }

  return texture;
}

// Create Buffers
function createBuffers(gl) {
  const positions = new Float32Array([
    -1, -1, 0, 0, 1, -1, 1, 0, -1, 1, 0, 1, 1, -1, 1, 0, 1, 1, 1, 1, -1, 1, 0,
    1,
  ]);

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(
    0,
    2,
    gl.FLOAT,
    false,
    4 * Float32Array.BYTES_PER_ELEMENT,
    0
  );

  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(
    1,
    2,
    gl.FLOAT,
    false,
    4 * Float32Array.BYTES_PER_ELEMENT,
    2 * Float32Array.BYTES_PER_ELEMENT
  );

  return vao;
}

async function setupWebGL() {
  const vertexShaderSource = await loadShaderFile("shaders/vertex.vert");
  const asciiShaderSource = await loadShaderFile("shaders/ascii.frag");
  const preprocessShaderSource = await loadShaderFile(
    "shaders/preprocess_shader.frag"
  );

  gl = canvas.getContext("webgl2");
  gl.viewport(0, 0, widthInChars, heightInChars);
  asciiShaderProgram = await initShaders(
    gl,
    vertexShaderSource,
    asciiShaderSource
  );
  preprocessShaderProgram = await initShaders(
    gl,
    vertexShaderSource,
    preprocessShaderSource
  );

  return gl;
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

      let symbolIndex = r + (g << 8) + (b << 16);
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
    !(
      prevForegroundColorList.length === foregroundColorList &&
      prevForegroundColorList.every((v, i) => v === foregroundColorList[i])
    ) ||
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
  const vao = createBuffers(gl);

  const imageTexture = createTexture(gl, img);
  const intermediateTexture = createTexture(
    gl,
    null,
    canvas.width,
    canvas.height
  );
  const framebuffer = createFramebuffer(gl, intermediateTexture);

  renderPreprocessShader(
    gl,
    preprocessShaderProgram,
    imageTexture,
    framebuffer,
    vao
  );

  renderAsciiShader(gl, asciiShaderProgram, intermediateTexture);

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
  svgContainer.innerHTML = "";
  svgContainer.appendChild(svg);
}

drawButton.addEventListener("click", draw, false);

function renderPreprocessShader(gl, program, texture, framebuffer, vao) {
  gl.useProgram(program);

  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.bindVertexArray(vao);

  // Set up attributes and uniforms

  const preprocessImageUniform = gl.getUniformLocation(
    preprocessShaderProgram,
    "img"
  );
  const curveLocation = gl.getUniformLocation(
    preprocessShaderProgram,
    "brightnessCurve"
  );

  const brightnessLocation = gl.getUniformLocation(
    preprocessShaderProgram,
    "brightness"
  );
  const contrastLocation = gl.getUniformLocation(
    preprocessShaderProgram,
    "contrast"
  );
  const saturationLocation = gl.getUniformLocation(
    preprocessShaderProgram,
    "saturation"
  );

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.uniform1i(preprocessImageUniform, 0);

  gl.uniform2fv(curveLocation, brightnessCurve.getPoints().flat());
  gl.uniform1f(brightnessLocation, brightness.value);
  gl.uniform1f(contrastLocation, contrast.value);
  gl.uniform1f(saturationLocation, saturation.value);

  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

function renderAsciiShader(gl, program, texture) {
  gl.viewport(0, 0, canvas.width, canvas.height);

  gl.useProgram(program);

  gl.bindFramebuffer(gl.FRAMEBUFFER, null); // Render to the canvas
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);

  const asciiImageUniform = gl.getUniformLocation(asciiShaderProgram, "img");
  const atlasSamplerUniformLocation = gl.getUniformLocation(
    asciiShaderProgram,
    "atlas"
  );
  const scalesLocation = gl.getUniformLocation(asciiShaderProgram, "scales");
  const scaleWeightsLocation = gl.getUniformLocation(
    asciiShaderProgram,
    "scaleWeights"
  );
  const numSymbolsLocation = gl.getUniformLocation(
    asciiShaderProgram,
    "numSymbols"
  );
  const atlasWidthLocation = gl.getUniformLocation(
    asciiShaderProgram,
    "atlasWidth"
  );
  const atlasHeightLocation = gl.getUniformLocation(
    asciiShaderProgram,
    "atlasHeight"
  );
  const charSizeLocation = gl.getUniformLocation(
    asciiShaderProgram,
    "charSize"
  );
  const resolutionLocation = gl.getUniformLocation(
    asciiShaderProgram,
    "resolution"
  );

  gl.uniform1i(asciiImageUniform, 0);

  gl.activeTexture(gl.TEXTURE1);
  const atlasTexture = createTexture(gl, characterAtlasImage);
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

  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

function createFramebuffer(gl, texture) {
  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

  const attachmentPoint = gl.COLOR_ATTACHMENT0;
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    attachmentPoint,
    gl.TEXTURE_2D,
    texture,
    0
  );

  return framebuffer;
}
