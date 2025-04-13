import React, { useEffect, useRef } from 'react';
import * as GeoTIFF from 'geotiff';

const TiffViewer = ({ tiffPath }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const renderTiff = async () => {
      try {
        // Load the TIFF file
        const response = await fetch(tiffPath);
        const arrayBuffer = await response.arrayBuffer();
        const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer);
        const image = await tiff.getImage();

        // Get image dimensions
        const width = image.getWidth();
        const height = image.getHeight();

        // Read raster data
        const data = await image.readRasters();
        const raster = data[0]; // Assuming single-band (grayscale)

        // Set up canvas
        const canvas = canvasRef.current;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // Create image data
        const imageData = ctx.createImageData(width, height);

        // Convert raster to RGB (grayscale for simplicity)
        for (let i = 0; i < raster.length; i++) {
          const val = Math.min(Math.max(raster[i], 0), 255); // Clamp values
          imageData.data[i * 4] = val; // R
          imageData.data[i * 4 + 1] = val; // G
          imageData.data[i * 4 + 2] = val; // B
          imageData.data[i * 4 + 3] = 255; // A
        }

        // Render to canvas
        ctx.putImageData(imageData, 0, 0);
      } catch (error) {
        console.error('Error loading TIFF:', error);
      }
    };

    renderTiff();
  }, [tiffPath]);

  return (
    <div>
      <h2>TIFF Viewer</h2>
      <canvas ref={canvasRef} />
    </div>
  );
};

export default TiffViewer;