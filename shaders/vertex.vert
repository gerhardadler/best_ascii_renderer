#version 300 es
in vec4 aVertexPosition;
out vec2 vTexCoord;

void main(void) {
    gl_Position = aVertexPosition;
    vTexCoord = aVertexPosition.xy * 0.5f + 0.5f;
}