export async function loadShaderFile(url) {
  const response = await fetch(url);
  return await response.text();
}

function compileShader(gl, sourceCode, type) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, sourceCode);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const error = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error("An error occurred compiling the shaders: " + error);
  }

  return shader;
}

export async function initShaders(
  gl,
  vertexShaderSource,
  fragmentShaderSource
) {
  const vertexShader = compileShader(gl, vertexShaderSource, gl.VERTEX_SHADER);
  const fragmentShader = compileShader(
    gl,
    fragmentShaderSource,
    gl.FRAGMENT_SHADER
  );

  const shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    throw new Error(
      "Unable to initialize the shader program: " +
        gl.getProgramInfoLog(shaderProgram)
    );
  }

  return shaderProgram;
}

function manuallyGenerateMipmaps(gl, image) {
  // Manually generate mipmaps
  let mipMapWidth = image.width;
  let mipMapHeight = image.height;
  let level = 1;

  // Loop until the texture is 1x1
  while (mipMapWidth > 1 || mipMapHeight > 1) {
    mipMapWidth = Math.max(1, mipMapWidth >> 1); // Divide width by 2
    mipMapHeight = Math.max(1, mipMapHeight >> 1); // Divide height by 2

    // Create a smaller canvas to render the mipmap level
    const mipmapCanvas = document.createElement("canvas");
    mipmapCanvas.width = mipMapWidth;
    mipmapCanvas.height = mipMapHeight;

    const ctx = mipmapCanvas.getContext("2d");
    ctx.drawImage(image, 0, 0, mipMapWidth, mipMapHeight);

    // Upload the mipmap level
    gl.texImage2D(
      gl.TEXTURE_2D,
      level,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      mipmapCanvas
    );

    level++;
  }
}

export function createTexture(
  gl,
  image = null,
  width = 0,
  height = 0,
  manuallyGenerateMipMaps = true
) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);

  if (image) {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  } else {
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null
    );
  }

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  if (image !== null) {
    if (manuallyGenerateMipMaps) {
      manuallyGenerateMipmaps(gl, image);
    } else {
      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MIN_FILTER,
        gl.LINEAR_MIPMAP_LINEAR
      );
      gl.generateMipmap(gl.TEXTURE_2D);
    }
  }

  return texture;
}

export const createBlurredTextureArray = (gl, image, blurLevels) => {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = image.width;
  canvas.height = image.height;

  // Create the 3D texture (TEXTURE_2D_ARRAY)
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture);

  // Allocate storage for the 3D texture (4 layers, RGBA format)
  gl.texStorage3D(
    gl.TEXTURE_2D_ARRAY,
    1,
    gl.RGBA8,
    image.width,
    image.height,
    blurLevels.length
  );

  // Upload each blurred version as a different layer (z-index)
  blurLevels.forEach((blurAmount, layer) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.filter = `blur(${blurAmount}px)`;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    // Upload to WebGL
    gl.texSubImage3D(
      gl.TEXTURE_2D_ARRAY,
      0,
      0,
      0,
      layer,
      canvas.width,
      canvas.height,
      1,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      ctx.getImageData(0, 0, canvas.width, canvas.height).data
    );
  });

  // Set texture parameters
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  return texture;
};

// Create Buffers
export function createBuffers(gl) {
  const positions = new Float32Array([
    -1, -1, 0, 0, 1, -1, 1, 0, -1, 1, 0, 1, 1, -1, 1, 0, 1, 1, 1, 1, -1, 1, 0,
    1,
  ]);

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(
    0,
    2,
    gl.FLOAT,
    false,
    4 * Float32Array.BYTES_PER_ELEMENT,
    0
  );

  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(
    1,
    2,
    gl.FLOAT,
    false,
    4 * Float32Array.BYTES_PER_ELEMENT,
    2 * Float32Array.BYTES_PER_ELEMENT
  );

  return vao;
}

export function createFramebuffer(gl, texture) {
  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

  const attachmentPoint = gl.COLOR_ATTACHMENT0;
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    attachmentPoint,
    gl.TEXTURE_2D,
    texture,
    0
  );

  return framebuffer;
}
