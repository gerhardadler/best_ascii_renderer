#version 300 es

precision highp float;

uniform sampler2D img;
uniform sampler2D atlas;
uniform float[4] scales;
uniform float[4] scaleWeights;
uniform int numSymbols;
uniform int atlasWidth;
uniform int atlasHeight;
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

float colorDistance(vec3 color1, vec3 color2) {
    vec3 lab1 = rgbToLab(color1);
    vec3 lab2 = rgbToLab(color2);
    
    // Euclidean distance in Lab space
    return length(lab1 - lab2);
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

  for (float i = 0.0; i < float(numSymbols); i++) {
    float cost = 0.0;
    for (int scaleI = 0; scaleI < 4; scaleI++) {
      float scale = scales[scaleI];
      float scaleWeight = scaleWeights[scaleI];

      float xStep = 1.0 / (charSize.x / pow(2.0, scale)) / 2.0;
      float yStep = 1.0 / (charSize.y / pow(2.0, scale)) / 2.0;

      vec2 atlasOffset = vec2(mod(i, float(atlasWidth)) / float(atlasWidth), floor(i / float(atlasWidth)) / float(atlasHeight));
      for (float x = xStep/2.0; x < 1.0; x += xStep) {
        for (float y = yStep/2.0; y < 1.0; y += yStep) {
          vec4 imgColor = textureLod(img, coords + vec2(x, y) / resolution, scale);

          imgColor.rgb = vec3(interpolate(imgColor.r), interpolate(imgColor.g), interpolate(imgColor.b));
          imgColor.rgb = clamp(imgColor.rgb, 0.0, 1.0);
          
          vec4 symbolColor = textureLod(atlas, atlasOffset + vec2(x, y) / vec2(atlasWidth * 3, atlasHeight * 3), scale);
          cost += colorDistance(imgColor.rgb, symbolColor.rgb) * (xStep * yStep) * scaleWeight;
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
  encodedColor.a = float(value & mask) / 255.0;

  // encodedColor = textureLod(atlas, coords, 3.0);
  
  fragColor = encodedColor;
}