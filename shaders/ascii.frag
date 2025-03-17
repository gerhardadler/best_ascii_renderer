#version 300 es

precision highp float;
precision highp sampler2DArray;

uniform sampler2D img;
uniform sampler2DArray atlas;
uniform float[4] scales;
uniform float[4] scaleWeights;

uniform float distanceExponent;

uniform int numSymbols;
uniform int atlasWidth;
uniform int atlasHeight;
uniform vec2 charSize;
uniform vec2 resolution;

uniform float hueWeight;
uniform float chromaWeight; // saturation
uniform float brightnessWeight;


in vec2 vTexCoord;

out vec4 fragColor;

vec3 rgbToLab(vec3 color) {
    // Convert sRGB to XYZ space
    float re = (color.r > 0.04045) ? pow((color.r + 0.055) / 1.055, 2.4) : color.r / 12.92;
    float gr = (color.g > 0.04045) ? pow((color.g + 0.055) / 1.055, 2.4) : color.g / 12.92;
    float bl = (color.b > 0.04045) ? pow((color.b + 0.055) / 1.055, 2.4) : color.b / 12.92;

    // sRGB to XYZ matrix conversion
    float x = re * 0.4124 + gr * 0.3576 + bl * 0.1805;
    float y = re * 0.2126 + gr * 0.7152 + bl * 0.0722;
    float z = re * 0.0193 + gr * 0.1192 + bl * 0.9505;

    // Normalize for the reference white D65
    x /= 0.95047;
    y /= 1.00000;
    z /= 1.08883;

    // XYZ to Lab conversion
    x = (x > 0.008856) ? pow(x, 1.0 / 3.0) : (7.787 * x) + (16.0 / 116.0);
    y = (y > 0.008856) ? pow(y, 1.0 / 3.0) : (7.787 * y) + (16.0 / 116.0);
    z = (z > 0.008856) ? pow(z, 1.0 / 3.0) : (7.787 * z) + (16.0 / 116.0);

    float l = (116.0 * y) - 16.0;
    float a = 500.0 * (x - y);
    float b = 200.0 * (y - z);

    return vec3(l, a, b);
}

float getColorDistance(vec3 color1, vec3 color2) {
    vec3 lab1 = rgbToLab(color1);
    vec3 lab2 = rgbToLab(color2);
    
    float dL = lab1.x - lab2.x; // Lightness difference
    float C1 = length(lab1.yz);
    float C2 = length(lab2.yz);
    float dC = C1 - C2; // Chroma difference
    float dH = length(lab1.yz - lab2.yz) - abs(dC); // Hue difference approximation

    return sqrt(brightnessWeight * dL * dL + chromaWeight * dC * dC + hueWeight * dH * dH);
}

void main() {
  // the subtraction is to start of the texture
  vec2 coords = vTexCoord - (0.5 / resolution);

  // vec2 coords = vTexCoord;

  // float i = 49.0;

  // vec2 atlasOffset = vec2(mod(i, float(atlasWidth)) / float(atlasWidth), floor(i / float(atlasWidth)) / float(atlasHeight));

  // fragColor = textureLod(atlas, atlasOffset + coords / vec2(atlasWidth * 3, atlasHeight * 3), 0.0);

  float minCost = 10000.0;
  int chosenSymbolOffset = 0;

  float characterWidthFraction = 1.0 / float(atlasWidth * 3 + 1);
  float characterHeightFraction = 1.0 / float(atlasHeight * 2 + 1);

  for (float i = 0.0; i < float(numSymbols); i++) {
    float cost = 0.0;
    for (int scaleI = 0; scaleI < 4; scaleI++) {
      float scale = scales[scaleI];
      float scaleWeight = scaleWeights[scaleI];

      float xStep = 1.0 / (charSize.x / pow(2.0, scale)) / 2.0;
      float yStep = 1.0 / (charSize.y / pow(2.0, scale)) / 2.0;

      vec2 atlasOffset = vec2(0,0);
      float xOffset = mod(i, float(atlasWidth));
      atlasOffset.x = ((1. - characterWidthFraction)/float(atlasWidth) * xOffset + characterWidthFraction);

      float yOffset = floor(i / float(atlasWidth));
      atlasOffset.y = ((1. - characterHeightFraction)/float(atlasHeight) * yOffset + characterHeightFraction);

      for (float x = xStep/2.0; x < 1.0; x += xStep) {
        for (float y = yStep/2.0; y < 1.0; y += yStep) {
          vec4 imgColor = texture(img, coords + vec2(x, y) / resolution);
          vec4 symbolColor = texture(atlas, vec3(atlasOffset + vec2(x, y) / vec2(atlasWidth * 3 + 1, atlasHeight * 2 + 1), scale));
          float colorDistance = getColorDistance(imgColor.rgb, symbolColor.rgb) * (xStep * yStep);

          cost += pow(colorDistance, distanceExponent) * scaleWeight;
        }
      }
    }

    if (cost < minCost) {
      minCost = cost;
      chosenSymbolOffset = int(i);
    }
  }

  int mask = 255;
  int value = chosenSymbolOffset;

  // encode value to fragcolor
  vec4 encodedColor;
  encodedColor.r = float(value & mask) / 255.0;
  value >>= 8;
  encodedColor.g = float(value & mask) / 255.0;
  value >>= 8;
  encodedColor.b = float(value & mask) / 255.0;
  value >>= 8;
  encodedColor.a = 1.0;

  // encodedColor = textureLod(atlas, coords, 3.0);
  
  fragColor = encodedColor;
}