// Convert SVG string to an Image object
export function svgToImage(svgString) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgString], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = function () {
      URL.revokeObjectURL(url); // Release memory
      resolve(img);
    };
    img.onerror = reject;
    img.src = url;
  });
}

export function loadImageFromURL(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = ""; // Enable CORS if necessary
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image from ${url}`));
    image.src = url;
  });
}
