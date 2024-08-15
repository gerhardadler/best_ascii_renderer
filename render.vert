#version 300 es
precision highp float;

in vec3 aPosition;
in vec2 aTexCoord;

out vec2 vTexCoord;

void main() {
    vec4 positionVec4 = vec4(aPosition, 1.0f);
    positionVec4.xy = positionVec4.xy * 2.0f - 1.0f;
    vTexCoord = aTexCoord;
    gl_Position = positionVec4;
}