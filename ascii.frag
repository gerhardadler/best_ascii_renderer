#version 300 es

precision mediump float;
precision mediump sampler2DArray;

uniform sampler2D img1;
uniform sampler2D img2;
uniform sampler2D img4;
uniform sampler2D img8;
uniform sampler2D atlas1;
uniform sampler2D atlas2;
uniform sampler2D atlas4;
uniform sampler2D atlas8;
uniform float[4] scales;
uniform float[4] scaleWeights;
uniform int numSymbols;
uniform vec2 resolution;

in vec2 vTexCoord;

out vec4 fragColor;

float colorDistance(vec3 color1, vec3 color2) {
  return length(color1 - color2);
}

vec4 getImgValue(int sampler, vec2 uv) {
    if (sampler == 1) {
        return texture(img1, uv);
    } else if (sampler == 2) {
        return texture(img2, uv);
    } else if (sampler == 4) {
        return texture(img4, uv);
    } else if (sampler == 8) {
        return texture(img8, uv);
    } else {
        return vec4(0.0); // Default case, should not happen if whichSampler is always 1, 2, or 3.
    }
}

vec4 getAtlasValue(int sampler, vec2 uv) {
    if (sampler == 1) {
        return texture(atlas1, uv);
    } else if (sampler == 2) {
        return texture(atlas2, uv);
    } else if (sampler == 4) {
        return texture(atlas4, uv);
    } else if (sampler == 8) {
        return texture(atlas8, uv);
    } else {
        return vec4(0.0); // Default case, should not happen if whichSampler is always 1, 2, or 3.
    }
}

void main() {
  vec2 coords = vTexCoord;
  coords.y = 1. - coords.y;
  vec2 texCoord = coords * resolution;


  vec2 symbolSize = vec2(8.0, 16.0);
  vec2 chunkCoord = floor(texCoord / symbolSize) * symbolSize;

  float minCost = 10000.0;
  float chosenSymbolOffset = 0.0;

  for (float i = 0.0; i < float(numSymbols); i++) {
    float cost = 0.0;
    for (int scaleI = 0; scaleI < 4; scaleI++) {
      float scale = scales[scaleI];
      float scaleWeight = scaleWeights[scaleI];
      vec2 scaledSymbolSize = symbolSize / scale;
      vec2 scaledChunkCoord = chunkCoord / scale;
      vec2 scaledResolution = resolution / scale;
      
      for (float x = 0.0; x < scaledSymbolSize.x; x++) {
        for (float y = 0.0; y < scaledSymbolSize.y; y++) {
          vec4 imgColor = getImgValue(int(scale), (scaledChunkCoord + vec2(x, y)) / scaledResolution) / 4.0;
          vec4 symbolColor = getAtlasValue(int(scale), vec2(i * scaledSymbolSize.x + x, y) / vec2(scaledSymbolSize.x * float(numSymbols), scaledSymbolSize.y));
          cost += colorDistance(imgColor.rgb, symbolColor.rgb) / (scaledSymbolSize.x * scaledSymbolSize.y) * scaleWeight;
        }
      }
    }

    if (cost < minCost) {
      minCost = cost;
      chosenSymbolOffset = float(i);
    }
  }

  vec2 symbolTexCoord = mod(texCoord, symbolSize);
  vec2 atlasTexCoord = vec2((symbolTexCoord.x + chosenSymbolOffset * 8.0) / float(numSymbols), symbolTexCoord.y) / symbolSize;
  fragColor = texture(atlas1, atlasTexCoord);
}