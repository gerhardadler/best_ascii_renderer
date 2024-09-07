#version 300 es

precision highp float;

uniform sampler2D img;
uniform sampler2D atlas;
uniform float[4] scales;
uniform float[4] scaleWeights;
uniform int numSymbols;
uniform vec2 charSize;
uniform vec2 resolution;

uniform vec2 curve[15]; // The brightness curve

// Function to linearly interpolate along the brightness curve
float interpolate(float x) {
    for (int i = 0; i < 14; ++i) {
        if (x >= curve[i].x && x <= curve[i + 1].x) {
            // Perform linear interpolation between curve[i] and curve[i + 1]
            float t = (x - curve[i].x) / (curve[i + 1].x - curve[i].x);
            return mix(curve[i].y, curve[i + 1].y, t);
        }
    }
    // If x is outside the curve range, clamp it to the first or last point
    return 1.0;
}


in vec2 vTexCoord;

out vec4 fragColor;

float colorDistance(vec3 color1, vec3 color2) {
  return length(color1 - color2);
}

void main() {
  vec2 coords = vTexCoord;
  // coords.y = 1. - coords.y;

  float minCost = 10000.0;
  float chosenSymbolOffset = 0.0;

  for (float i = 0.0; i < float(numSymbols); i++) {
    float cost = 0.0;
    for (int scaleI = 0; scaleI < 4; scaleI++) {
      float scale = scales[scaleI];
      float scaleWeight = scaleWeights[scaleI];

      float xStep = 1.0 / (charSize.x / pow(2.0, scale));
      float yStep = 1.0 / (charSize.y / pow(2.0, scale));


      // vec2 scaledSymbolSize = charSize / scale;
      // vec2 scaledResolution = resolution * scaledSymbolSize;
      
      // float yIncrement =  charSize.y / 8.0;

      // for (float x = 0.5; x < scaledSymbolSize.x; x++) {
      //   for (float y = yIncrement/2.0; y < scaledSymbolSize.y; y+=yIncrement) {
      //     vec4 imgColor = textureLod(img, coords + (vec2(x, y) / scaledResolution), scale);
      //     // imgColor.rgb = (imgColor.rgb - 0.5) * contrast + brightness;
      //     imgColor.rgb = vec3(interpolate(imgColor.r), interpolate(imgColor.g), interpolate(imgColor.b));
      //     imgColor.rgb = clamp(imgColor.rgb, 0.0, 1.0);
      //     vec2 atlasOffset = vec2(i / float(numSymbols),0.0);
      //     vec4 symbolColor = textureLod(atlas, atlasOffset + (vec2(x, y) / vec2(scaledSymbolSize.x*float(numSymbols), scaledSymbolSize.y)), scale);
      //     cost += colorDistance(imgColor.rgb, symbolColor.rgb) / (scaledSymbolSize.x * scaledSymbolSize.y) * scaleWeight;
      //   }
      // }
      vec2 atlasOffset = vec2(i / float(numSymbols),0.0);
      for (float x = xStep/2.0; x < 1.0; x += xStep) {
        for (float y = yStep/2.0; y < 1.0; y += yStep) {
          vec4 imgColor = textureLod(img, coords + vec2(x, y) / resolution, scale);

          imgColor.rgb = vec3(interpolate(imgColor.r), interpolate(imgColor.g), interpolate(imgColor.b));
          imgColor.rgb = clamp(imgColor.rgb, 0.0, 1.0);
          
          vec4 symbolColor = textureLod(atlas, atlasOffset + vec2(x, y) / vec2(numSymbols, 1.0), scale);
          cost += colorDistance(imgColor.rgb, symbolColor.rgb) / (100.0 * 100.0) * scaleWeight;
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