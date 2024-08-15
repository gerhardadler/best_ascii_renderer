#version 300 es

precision highp float;

uniform sampler2D atlas;
uniform sampler2D chosenSymbols;
uniform vec2 resolution;
uniform float numSymbols;

in vec2 vTexCoord;

out vec4 fragColor;

void main() {
  vec2 coords = vTexCoord;
  coords.y = 1. - coords.y;
  vec2 symbolSize = vec2(8.0, 16.0);

  vec2 x = floor(coords * resolution) / resolution + 0.5 / resolution;

  vec4 encodedSymbol = texture(chosenSymbols, x) ;
  float chosenSymbol  = encodedSymbol.r +
                       encodedSymbol.g / 256.0 +
                       encodedSymbol.b / (256.0 * 256.0) +
                       encodedSymbol.a / (256.0 * 256.0 * 256.0);
  chosenSymbol = floor(chosenSymbol * numSymbols) / numSymbols;
  
  vec2 offset = mod(coords * resolution * symbolSize, symbolSize) / symbolSize;
  offset.x /= numSymbols;

  fragColor = texture(atlas, vec2(chosenSymbol, 0.0) + offset);
}