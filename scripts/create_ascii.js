import {
  createTexture,
  createFramebuffer,
  createBuffers,
  loadShaderFile,
  initShaders,
} from "./gl_utils.js";
import { svgToImage } from "./utils.js";

const maxCharacterAtlasWidth = 95;
const baseFontSize = 16;

export class TextParameters {
  constructor(
    characters,
    additionalStyles,
    fontFamily,
    fontWeight,
    lineHeight,
    backgroundColor,
    foregroundColorList
  ) {
    this.characters = characters;
    this.additionalStyles = additionalStyles;
    this.fontFamily = fontFamily;
    this.fontWeight = fontWeight;
    this.lineHeight = lineHeight;
    this.backgroundColor = backgroundColor;
    this.foregroundColorList = foregroundColorList;
  }

  getFontStyle() {
    let styleString = "";
    styleString += `font-family: ${this.fontFamily};`;
    styleString += `font-weight: ${this.fontWeight};`;
    for (let key in this.additionalStyles) {
      styleString += `${key}: ${this.additionalStyles[key]};`;
    }
    return styleString;
  }

  getCharacterColorList() {
    const characterColorList = [];
    this.foregroundColorList.forEach((foregroundColor) => {
      this.characters.split("").forEach((character) => {
        characterColorList.push({
          foregroundColor,
          character,
        });
      });
    });
    return characterColorList;
  }
}

export class AsciiParameters {
  constructor(scaleWeights) {
    this.scaleWeights = scaleWeights;
  }
}

export class PreprocessorParameters {
  constructor(brightnessCurve, brightness, contrast, saturation) {
    this.brightnessCurve = brightnessCurve;
    this.brightness = brightness;
    this.contrast = contrast;
    this.saturation = saturation;
  }
}

export class CharacterAtlas {
  constructor(
    image,
    widthInChars,
    heightInChars,
    characterWidth,
    characterHeight,
    calculatedFontSize
  ) {
    this.image = image;
    this.widthInChars = widthInChars;
    this.heightInChars = heightInChars;
    this.characterWidth = characterWidth;
    this.characterHeight = characterHeight;
    this.calculatedFontSize = calculatedFontSize;
  }
}

export class InputCanvas {
  constructor(canvas, widthInChars, heightInChars) {
    this.canvas = canvas;
    this.widthInChars = widthInChars;
    this.heightInChars = heightInChars;
  }
}

function measureCharacterWidth(char, textParameters) {
  let svgNS = "http://www.w3.org/2000/svg";
  let tempSvg = document.createElementNS(svgNS, "svg");
  tempSvg.setAttribute("style", textParameters.getFontStyle());
  let tempText = document.createElementNS(svgNS, "text");
  tempText.setAttribute("font-size", baseFontSize);
  tempText.textContent = char;
  tempSvg.appendChild(tempText);
  document.body.appendChild(tempSvg);
  let bbox = tempText.getBBox();
  document.body.removeChild(tempSvg);
  return [bbox.width, bbox.height];
}

export async function createCharacterAtlas(textParameters) {
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");

  svg.setAttribute(
    "style",
    textParameters.getFontStyle() +
      `background: ${textParameters.backgroundColor};`
  );
  // Measure character width
  let [initialCharWidth, initialCharHeight] = measureCharacterWidth(
    "M",
    textParameters
  );
  let fontWidth = 8;
  let charWidthScale = fontWidth / initialCharWidth;
  let adjustedCharHeight = initialCharHeight * charWidthScale;

  let calculatedFontSize = baseFontSize * charWidthScale;
  let calculatedLineHeight = Math.round(
    adjustedCharHeight * textParameters.lineHeight
  );

  const characterColorList = textParameters.getCharacterColorList();

  for (let i = 0; i < characterColorList.length; i++) {
    const characterColor = characterColorList[i];

    let y = Math.floor(i / maxCharacterAtlasWidth);
    let x = i % maxCharacterAtlasWidth;

    let textElem = document.createElementNS(svgNS, "text");
    textElem.setAttribute("x", x * 3 * fontWidth);
    textElem.setAttribute(
      "y",
      calculatedFontSize + y * 3 * calculatedLineHeight
    );
    textElem.setAttribute("fill", characterColor.foregroundColor);

    textElem.setAttribute("font-size", `${calculatedFontSize}px`);
    textElem.textContent = characterColor.character;
    svg.appendChild(textElem);
  }

  // Set overall SVG dimensions
  const atlasWidth = maxCharacterAtlasWidth;
  const atlasHeight = Math.ceil(
    characterColorList.length / maxCharacterAtlasWidth
  );

  svg.setAttribute("width", fontWidth * atlasWidth * 3);
  svg.setAttribute("height", calculatedLineHeight * atlasHeight * 3);

  let serializedSvg = new XMLSerializer().serializeToString(svg);

  const characterAtlasImage = await svgToImage(serializedSvg);
  const charWidth = characterAtlasImage.width / atlasWidth / 3;
  const charHeight = characterAtlasImage.height / atlasHeight / 3;

  return new CharacterAtlas(
    characterAtlasImage,
    atlasWidth,
    atlasHeight,
    charWidth,
    charHeight,
    calculatedFontSize
  );
}

function renderPreprocessShader(
  gl,
  program,
  texture,
  inputImage,
  preprocessParameters
) {
  gl.useProgram(program);
  gl.viewport(0, 0, inputImage.width, inputImage.height);
  // Set up attributes and uniforms

  const preprocessImageUniform = gl.getUniformLocation(program, "img");
  const curveLocation = gl.getUniformLocation(program, "brightnessCurve");

  const brightnessLocation = gl.getUniformLocation(program, "brightness");
  const contrastLocation = gl.getUniformLocation(program, "contrast");
  const saturationLocation = gl.getUniformLocation(program, "saturation");

  const vao = createBuffers(gl);
  gl.bindVertexArray(vao);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.uniform1i(preprocessImageUniform, 0);

  gl.uniform2fv(curveLocation, preprocessParameters.brightnessCurve);
  gl.uniform1f(brightnessLocation, preprocessParameters.brightness);
  gl.uniform1f(contrastLocation, preprocessParameters.contrast);
  gl.uniform1f(saturationLocation, preprocessParameters.saturation);

  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

function renderAsciiShader(
  gl,
  program,
  texture,
  inputCanvas,
  atlas,
  asciiParameters,
  textParameters
) {
  gl.viewport(0, 0, inputCanvas.widthInChars, inputCanvas.heightInChars);

  gl.useProgram(program);

  const asciiImageUniform = gl.getUniformLocation(program, "img");
  const atlasSamplerUniformLocation = gl.getUniformLocation(program, "atlas");
  const scalesLocation = gl.getUniformLocation(program, "scales");
  const scaleWeightsLocation = gl.getUniformLocation(program, "scaleWeights");
  const numSymbolsLocation = gl.getUniformLocation(program, "numSymbols");
  const atlasWidthLocation = gl.getUniformLocation(program, "atlasWidth");
  const atlasHeightLocation = gl.getUniformLocation(program, "atlasHeight");
  const charSizeLocation = gl.getUniformLocation(program, "charSize");
  const resolutionLocation = gl.getUniformLocation(program, "resolution");

  const vao = createBuffers(gl);
  gl.bindVertexArray(vao);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.uniform1i(asciiImageUniform, 0);

  gl.activeTexture(gl.TEXTURE1);
  const atlasTexture = createTexture(gl, atlas.image);
  gl.bindTexture(gl.TEXTURE_2D, atlasTexture);
  gl.uniform1i(atlasSamplerUniformLocation, 1);

  // Pass the float arrays to the shader
  gl.uniform1fv(scalesLocation, [0, 1, 2, 3]);
  gl.uniform1fv(scaleWeightsLocation, asciiParameters.scaleWeights);

  gl.uniform1i(
    numSymbolsLocation,
    textParameters.getCharacterColorList().length
  );
  gl.uniform1i(atlasWidthLocation, atlas.widthInChars);
  gl.uniform1i(atlasHeightLocation, atlas.heightInChars);

  gl.uniform2fv(charSizeLocation, [
    atlas.characterWidth,
    atlas.characterHeight,
  ]);
  gl.uniform2fv(resolutionLocation, [
    inputCanvas.widthInChars,
    inputCanvas.heightInChars,
  ]);

  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

export async function createAscii(
  inputCanvas,
  preprocessCanvas,
  inputImage,
  characterAtlas,
  textParameters,
  preprocessParameters,
  asciiParameters
) {
  const asciiGl = inputCanvas.canvas.getContext("webgl2");
  const preprocessGl = preprocessCanvas.getContext("webgl2");

  const vertexShaderSource = await loadShaderFile("shaders/vertex.vert");
  const asciiShaderSource = await loadShaderFile("shaders/ascii.frag");
  const preprocessShaderSource = await loadShaderFile(
    "shaders/preprocess_shader.frag"
  );

  const asciiShaderProgram = await initShaders(
    asciiGl,
    vertexShaderSource,
    asciiShaderSource
  );

  const preprocessShaderProgram = await initShaders(
    preprocessGl,
    vertexShaderSource,
    preprocessShaderSource
  );

  const imageTexture = createTexture(preprocessGl, inputImage);

  renderPreprocessShader(
    preprocessGl,
    preprocessShaderProgram,
    imageTexture,
    inputImage,
    preprocessParameters
  );

  const intermediateTexture = createTexture(asciiGl, preprocessCanvas);

  renderAsciiShader(
    asciiGl,
    asciiShaderProgram,
    intermediateTexture,
    inputCanvas,
    characterAtlas,
    asciiParameters,
    textParameters
  );

  const pixelData = new Uint8Array(
    inputCanvas.widthInChars * inputCanvas.heightInChars * 4
  ); // 4 bytes per pixel

  // Read pixels from the WebGL canvas (bottom-left to top-right)
  asciiGl.readPixels(
    0, // x coordinate
    0, // y coordinate (bottom-left corner)
    inputCanvas.widthInChars, // width of the canvas
    inputCanvas.heightInChars, // height of the canvas
    asciiGl.RGBA, // format to read (RGBA)
    asciiGl.UNSIGNED_BYTE, // type of data to read
    pixelData // typed array to store pixel data
  );

  return pixelData;
}
