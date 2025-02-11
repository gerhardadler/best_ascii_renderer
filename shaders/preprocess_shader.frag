#version 300 es

precision highp float;

in vec2 vTexCoord;
out vec4 fragColor;

uniform sampler2D img;
uniform vec2 brightnessCurve[15];
uniform float brightness;
uniform float contrast;
uniform float saturation;

float interpolate(vec2[15] curve, float x) {
  for(int i = 0; i < 14; ++i) {
    if(x >= curve[i].x && x <= curve[i + 1].x) {
      // Perform linear interpolation between curve[i] and curve[i + 1]
      float t = (x - curve[i].x) / (curve[i + 1].x - curve[i].x);
      return mix(curve[i].y, curve[i + 1].y, t);
    }
  }
    // If x is outside the curve range, clamp it to the first or last point
  return 1.0f;
}

void main() {
  vec2 coord = vec2(vTexCoord.x, 1.0 - vTexCoord.y);
  vec4 imgColor = texture(img, coord);

  imgColor.rgb = vec3(interpolate(brightnessCurve, imgColor.r), interpolate(brightnessCurve, imgColor.g), interpolate(brightnessCurve, imgColor.b));

  imgColor.rgb = (imgColor.rgb - 0.5f) * contrast + 0.5f + brightness;

  vec3 gray = vec3(dot(imgColor.rgb, vec3(0.299f, 0.587f, 0.114f)));
  imgColor.rgb = mix(gray, imgColor.rgb, saturation);

  imgColor.rgb = clamp(imgColor.rgb, 0.0f, 1.0f);
  fragColor = imgColor;
}