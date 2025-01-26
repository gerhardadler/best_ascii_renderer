export function getOutputSVG(
  pixelData,
  textParameters,
  widthInChars,
  heightInChars,
  charHeight,
  calculatedFontSize
) {
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("style", textParameters.getFontStyle());

  let characterColorList = textParameters.getCharacterColorList();

  let svgText = document.createElementNS(svgNS, "text");
  svgText.setAttribute("x", 0);
  svgText.setAttribute("y", 0);
  svgText.setAttribute("style", textParameters.getFontStyle());
  svgText.setAttribute("font-size", calculatedFontSize);
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
  backgroundRect.setAttribute("fill", textParameters.backgroundColor);
  svg.insertBefore(backgroundRect, svg.firstChild);

  svg.setAttribute("width", textBBox.width);
  svg.setAttribute("height", textBBox.height);

  return svg;
}
