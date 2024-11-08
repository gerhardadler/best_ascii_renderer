let charWidth;
let charHeight;
let widthInChars;
let heightInChars;

const fontSize = 12;
let adjustedFontSize;

let img;
let gl;
let shaderProgram;
let characterAtlasImage;

let canvas = document.getElementById("glCanvas");
let imageField = document.getElementById("image");
let widthInCharsField = document.getElementById("symbol-width");
let characterForegroundField = document.getElementById("character-foreground");
let characterBackgroundField = document.getElementById("character-background");
let lineHeightField = document.getElementById("line-height");
let charsField = document.getElementById("chars");
let brightnessCurveSvg = document.getElementById("brightness-curve");
let brightnessCurve = new Curve(brightnessCurveSvg, [
  [0, 0],
  [1, 0.3],
]);

let scaleWeight1 = document.getElementById("scale-weight-1");
let scaleWeight2 = document.getElementById("scale-weight-2");
let scaleWeight4 = document.getElementById("scale-weight-4");
let scaleWeight8 = document.getElementById("scale-weight-8");
let drawButton = document.getElementById("draw-button");
let outputText = document.getElementById("out");

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

function measureCharacterWidth(char, fontFamily, fontSize) {
  let svgNS = "http://www.w3.org/2000/svg";
  let tempSvg = document.createElementNS(svgNS, "svg");
  const svgStyle = document.createElementNS(svgNS, "style");
  svgStyle.textContent = `@font-face {
    font-family: render-font;
    src: url('${base64Font}');
  }`;
  tempSvg.appendChild(svgStyle);
  tempSvg.setAttribute(
    "style",
    `background-color: ${characterBackgroundField.value};
    white-space: pre;
    font-family: ${base64Font !== undefined ? "render-font" : "monospace"};
    font-variant-ligatures: none;`
  );
  let tempText = document.createElementNS(svgNS, "text");
  tempText.setAttribute("font-family", fontFamily);
  tempText.setAttribute("font-size", fontSize);
  tempText.textContent = char;
  tempSvg.appendChild(tempText);
  document.body.appendChild(tempSvg);
  let bbox = tempText.getBBox();
  document.body.removeChild(tempSvg);
  return [bbox.width, bbox.height];
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

  let fontFamily = base64Font !== undefined ? "render-font" : "monospace";

  svg.setAttribute(
    "style",
    `background-color: ${characterBackgroundField.value};
    font-family: ${fontFamily};
    font-variant-ligatures: none;`
  );
  // Measure character width
  let [initialCharWidth, initialCharHeight] = measureCharacterWidth(
    "M",
    fontFamily,
    fontSize
  );
  let fontWidth = 8;
  let charWidthScale = fontWidth / initialCharWidth;
  let adjustedCharHeight = initialCharHeight * charWidthScale;
  adjustedFontSize = fontSize * charWidthScale;

  for (let i = 0; i < charsField.value.length; i++) {
    let textElem = document.createElementNS(svgNS, "text");
    textElem.setAttribute("x", i * 3 * fontWidth);
    textElem.setAttribute("y", adjustedFontSize); // Adjust 'y' as needed
    // textElem.setAttribute("font-family", fontFamily);
    textElem.setAttribute("fill", characterForegroundField.value);

    textElem.setAttribute("font-size", `${adjustedFontSize}px`);
    textElem.setAttribute("kerning", "0");
    textElem.setAttribute("letter-spacing", "0");
    textElem.textContent = charsField.value[i];
    svg.appendChild(textElem);
  }

  // Set overall SVG dimensions
  console.log(fontWidth);
  svg.setAttribute("width", fontWidth * charsField.value.length * 3);
  svg.setAttribute("height", adjustedCharHeight * lineHeightField.value); // Adjust as needed for line height

  document.body.appendChild(svg);

  return new XMLSerializer().serializeToString(svg);

  // const svgText = document.createElementNS(svgNS, "text");
  // svgText.setAttribute("x", 0);
  // svgText.setAttribute("y", fontSize); // Align text with the top
  // svgText.setAttribute("fill", characterForegroundField.value);
  // svgText.setAttribute("font-size", fontSize);
  // svgText.innerHTML = charsField.value.replaceAll(" ", "&nbsp;");
  // svg.appendChild(svgText);

  // document.body.appendChild(svg);
  // const textBBox = svgText.getBBox();
  // document.body.removeChild(svg);

  // svg.setAttribute("width", textBBox.width);
  // svg.setAttribute("height", textBBox.height);
  // return new XMLSerializer().serializeToString(svg);
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
      let symbolIndex = Math.round(chosenSymbol * charsField.value.length);
      textLine += charsField.value.charAt(symbolIndex);
    }
    let svgText = document.createElementNS(svgNS, "text");
    svgText.setAttribute("x", 0);
    svgText.setAttribute("y", y * charHeight + charHeight); // Align text with the top
    svgText.setAttribute("fill", characterForegroundField.value);
    svgText.setAttribute("font-size", adjustedFontSize);
    svgText.setAttribute("xml:space", "preserve"); // Preserve whitespace

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
let prevChars;
let prevBackground;
let prevForeground;
let prevLineHeight;
let prevBase64Font;

async function draw() {
  if (img === undefined) {
    return;
  }
  let setupRequired = false;
  if (
    prevWidthInChars !== widthInCharsField.value ||
    prevChars !== charsField.value ||
    prevBackground !== characterBackgroundField.value ||
    prevForeground !== characterForegroundField.value ||
    prevLineHeight !== lineHeightField.value ||
    prevBase64Font !== base64Font
  ) {
    let characterAtlas = createCharacterAtlas();
    characterAtlasImage = await svgToImage(characterAtlas);
    console.log(characterAtlasImage.width);
    console.log(characterAtlasImage.width / charsField.value.length / 3);
    charHeight = characterAtlasImage.height;
    charWidth = characterAtlasImage.width / charsField.value.length / 3;
    setupRequired = true;
    prevWidthInChars = widthInCharsField.value;
    prevChars = charsField.value;
    prevBackground = characterBackgroundField.value;
    prevForeground = characterForegroundField.value;
    prevLineHeight = lineHeightField.value;
    prevBase64Font = base64Font;
  }

  if (prevImg !== img) {
    setupRequired = true;
    prevImg = img;
  }

  if (setupRequired) {
    console.log("Setting up WebGL");
    widthInChars = widthInCharsField.value;
    heightInChars = Math.round(
      (img.height / img.width) * widthInChars * (charWidth / charHeight)
    );
    // widthInChars = charWidth * charsField.value.length * 3;
    // heightInChars = charHeight;

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
  gl.uniform1fv(scalesLocation, [0, 1, 2, 3]);
  gl.uniform1fv(scaleWeightsLocation, [
    parseFloat(scaleWeight1.value),
    parseFloat(scaleWeight2.value),
    parseFloat(scaleWeight4.value),
    parseFloat(scaleWeight8.value),
  ]);

  console.log(charsField.value.length);
  console.log(charsField.value);
  gl.uniform1i(numSymbolsLocation, charsField.value.length);

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

  // i want to get the average brightness of each letter of the image
  // the image consist of all the letters after each other with 3 spaces between each letter
  // the letters have the height: charHeight and the width: charWidth
  // the image is stored in pixelData with the format: RGBA
  const writePre = document.getElementById("write");
  for (x = 0; x < widthInChars / charWidth; x++) {
    let sum = 0;
    for (i = 0; i < charWidth; i++) {
      for (j = 0; j < charHeight; j++) {
        const index = (x * charWidth + i + j * widthInChars) * 3;
        sum += pixelData[index] + pixelData[index + 1] + pixelData[index + 2];
      }
    }
    writePre.textContent +=
      charsField.value[x / 3] +
      ": " +
      sum / (charWidth * charHeight * 3) +
      "\n";
  }

  const svg = getOutputSVG(pixelData, widthInChars, heightInChars, charHeight);
  document.getElementById("out").innerHTML = svg.outerHTML;
}

drawButton.addEventListener("click", draw, false);
