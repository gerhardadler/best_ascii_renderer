#version 300 es

precision highp float;

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
uniform vec2 charSize;
uniform vec2 resolution;
uniform float contrast;
uniform float brightness;

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

  float minCost = 10000.0;
  float chosenSymbolOffset = 0.0;

  for (float i = 0.0; i < float(numSymbols); i++) {
    float cost = 0.0;
    for (int scaleI = 0; scaleI < 4; scaleI++) {
      float scale = scales[scaleI];
      float scaleWeight = scaleWeights[scaleI];
      vec2 scaledSymbolSize = charSize / scale;
      vec2 scaledResolution = resolution * scaledSymbolSize;
      
      float yIncrement =  charSize.y / 8.0;

      for (float x = 0.5; x < scaledSymbolSize.x; x++) {
        for (float y = yIncrement/2.0; y < scaledSymbolSize.y; y+=yIncrement) {
          vec4 imgColor = getImgValue(int(scale), coords + (vec2(x, y) / scaledResolution));
          imgColor.rgb = (imgColor.rgb - 0.5) * contrast + brightness;
          imgColor.rgb = clamp(imgColor.rgb, 0.0, 1.0);
          vec2 atlasOffset = vec2(i / float(numSymbols),0.0);
          vec4 symbolColor = getAtlasValue(int(scale), atlasOffset + (vec2(x, y) / vec2(scaledSymbolSize.x*float(numSymbols), scaledSymbolSize.y)));
          cost += colorDistance(imgColor.rgb, symbolColor.rgb) / (scaledSymbolSize.x * scaledSymbolSize.y) * scaleWeight;
        }
      }
    }

    if (cost < minCost) {
      minCost = cost;
      chosenSymbolOffset = float(i);
    }
  }

  float value = chosenSymbolOffset / float(numSymbols);
  // encode value to fragcolor
  vec4 encodedColor;
  encodedColor.r = fract(value);
  encodedColor.g = fract(value * 256.0);
  encodedColor.b = fract(value * 256.0 * 256.0);
  encodedColor.a = fract(value * 256.0 * 256.0 * 256.0);
  
  fragColor = encodedColor;
}