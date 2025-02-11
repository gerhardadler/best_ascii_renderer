#version 300 es

precision highp float;

in vec2 vTexCoord;
out vec4 fragColor;

uniform sampler2D img;

void main() {
  vec4 imgColor = texture(img, vTexCoord);
  fragColor = imgColor;
}