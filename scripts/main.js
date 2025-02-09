import {
  TextParameters,
  createCharacterAtlas,
  InputCanvas,
  createAscii,
  PreprocessorParameters,
  AsciiParameters,
} from "./create_ascii.js";
import { getOutputSVG } from "./get_output_svg.js";
import { Curve } from "./curves.js";
import { svgToImage } from "./utils.js";

let img;
const imageField = document.getElementById("image");
const widthInCharsField = document.getElementById("symbol-width");
const lineHeightField = document.getElementById("line-height");
const charsField = document.getElementById("chars");
const brightnessCurveSvg = document.getElementById("brightness-curve");
const brightnessCurve = new Curve(brightnessCurveSvg, [
  [0, 0],
  [1, 1],
]);
const brightness = document.getElementById("brightness");
const contrast = document.getElementById("contrast");
const saturation = document.getElementById("saturation");

const scaleWeight1 = document.getElementById("scale-weight-1");
const scaleWeight2 = document.getElementById("scale-weight-2");
const scaleWeight4 = document.getElementById("scale-weight-4");
const scaleWeight8 = document.getElementById("scale-weight-8");
const drawButton = document.getElementById("draw-button");
const doc = document.getElementById("document");
const fontNameField = document.getElementById("font-name");
const fontWeightField = document.getElementById("font-weight");

const backgroundColorField = document.getElementById("background-color");

const addCustomColorButton = document.getElementById("add-custom-color-button");
const colorInput = document.getElementById("custom-color");
const colorListElement = document.getElementById("color-list");

const documentWidthView = document.getElementById("document-width");
const zoomInButton = document.getElementById("zoom-in");
const zoomOutButton = document.getElementById("zoom-out");

const pngWidthField = document.getElementById("png-width");
const downloadPngButton = document.getElementById("download-png-button");
const downloadSvgButton = document.getElementById("download-svg-button");

let documentWidth = 1000;
documentWidthView.textContent = documentWidth;
doc.style.width = `${documentWidth}px`;

zoomInButton.addEventListener("click", function () {
  documentWidth += 20;
  documentWidthView.textContent = documentWidth;
  doc.style.width = `${documentWidth}px`;
});

zoomOutButton.addEventListener("click", function () {
  documentWidth -= 20;
  documentWidthView.textContent = documentWidth;
  doc.style.width = `${documentWidth}px`;
});

downloadPngButton.addEventListener("click", async function () {
  const svg = document.querySelector("svg");
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
    let url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "output.png";
    a.click();

    URL.revokeObjectURL(url);
  });
});

downloadSvgButton.addEventListener("click", function () {
  const svg = document.querySelector("svg");
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

async function draw() {
  const textParameters = new TextParameters(
    charsField.value,
    {
      "white-space": "pre",
      "font-variant-ligatures": "none",
    },
    fontNameField.value,
    fontWeightField.value,
    lineHeightField.value,
    backgroundColorField.value,
    foregroundColorList
  );
  const preprocessParameters = new PreprocessorParameters(
    brightnessCurve.getPoints().flat(),
    parseFloat(brightness.value),
    parseFloat(contrast.value),
    parseFloat(saturation.value)
  );
  const asciiParameters = new AsciiParameters([
    parseFloat(scaleWeight1.value),
    parseFloat(scaleWeight2.value),
    parseFloat(scaleWeight4.value),
    parseFloat(scaleWeight8.value),
  ]);

  const characterAtlas = await createCharacterAtlas(textParameters);

  const widthInChars = parseInt(widthInCharsField.value);
  const heightInChars = Math.round(
    (img.height / img.width) *
      widthInChars *
      (characterAtlas.characterWidth / characterAtlas.characterHeight)
  );

  const canvas = document.createElement("canvas");
  canvas.width = widthInChars;
  canvas.height = heightInChars;

  const inputCanvas = new InputCanvas(canvas, widthInChars, heightInChars);
  const pixelData = await createAscii(
    inputCanvas,
    img,
    characterAtlas,
    textParameters,
    preprocessParameters,
    asciiParameters
  );

  const svg = getOutputSVG(
    pixelData,
    textParameters,
    widthInChars,
    heightInChars,
    characterAtlas.characterHeight,
    characterAtlas.calculatedFontSize
  );

  doc.innerHTML = "";
  doc.appendChild(svg);
}

drawButton.addEventListener("click", draw);
