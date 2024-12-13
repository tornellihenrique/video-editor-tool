const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');

const getVideoMetadata = videoPath => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        return reject(err);
      }
      const videoStream = metadata.streams.find(
        stream => stream.codec_type === 'video',
      );
      if (!videoStream) {
        return reject(new Error('No video stream found'));
      }
      resolve({
        width: videoStream.width,
        height: videoStream.height,
        duration: videoStream.duration,
      });
    });
  });
};

function mergeScenes(intermediateFiles, outputPath) {
  return new Promise((resolve, reject) => {
    const fileListPath = path.join(path.dirname(outputPath), 'file_list.txt');

    // Create a file list for FFmpeg concat
    const fileListContent = intermediateFiles
      .map(filePath => `file '${filePath}'`)
      .join('\n');
    fs.writeFileSync(fileListPath, fileListContent);

    // Use FFmpeg concat to merge scenes
    ffmpeg()
      .input(fileListPath)
      .inputOptions(['-f', 'concat', '-safe', '0'])
      .outputOptions(['-c', 'copy']) // Avoid re-encoding
      .output(outputPath)
      .on('start', commandLine => {
        console.log(`FFmpeg merge command: ${commandLine}`);
      })
      .on('end', () => {
        console.log('Final video merge complete:', outputPath);
        fs.unlinkSync(fileListPath); // Clean up temporary file list
        resolve(outputPath);
      })
      .on('error', (err, stdout, stderr) => {
        console.error('Error during video merge:', err.message);
        console.error('FFmpeg stdout:', stdout);
        console.error('FFmpeg stderr:', stderr);
        reject(err);
      })
      .run();
  });
}

// function getFilters(crop, transform, targetWidth, targetHeight, scaleX, scaleY) {
//   const { scale = 1.0, position } = transform || {};
//   const { x = 0, y = 0 } = position || {};

//   // Calculate scaled dimensions based on user-defined scale
//   let scaledWidth = Math.floor(crop.width * scale);
//   let scaledHeight = Math.floor(crop.height * scale);

//   // Ensure scaled dimensions fit within the target frame
//   const maxScaleX = targetWidth / scaledWidth;
//   const maxScaleY = targetHeight / scaledHeight;
//   const effectiveScale = Math.min(1.0, maxScaleX, maxScaleY);

//   // Adjust scaled dimensions based on effective scale
//   scaledWidth = Math.floor(scaledWidth * effectiveScale);
//   scaledHeight = Math.floor(scaledHeight * effectiveScale);

//   // Adjust position to ensure it doesn't overflow the target frame
//   const adjustedX = Math.min(Math.max(Math.floor(x * scaleX), 0), targetWidth - scaledWidth);
//   const adjustedY = Math.min(Math.max(Math.floor(y * scaleY), 0), targetHeight - scaledHeight);

//   return [
//     // Crop the user-defined area
//     `crop=${crop.width}:${crop.height}:${crop.x}:${crop.y}`,
//     // Apply user-defined scaling and fit within the target resolution
//     `scale=${scaledWidth}:${scaledHeight}`,
//     // Pad the scaled content into the target frame at the specified position
//     `pad=${targetWidth}:${targetHeight}:${adjustedX}:${adjustedY}`
//   ];
// }

function getFilters(
  crop,
  transform,
  targetWidth,
  targetHeight,
  virtualWidth,
  virtualHeight,
) {
  // Compute position in final output space
  const adjustedX = Math.floor(
    (transform.position.x / virtualWidth) * targetWidth,
  );
  const adjustedY = Math.floor(
    (transform.position.y / virtualHeight) * targetHeight,
  );

  // Compute the scaled size of the cropped area
  const scaledWidth = Math.floor(crop.width * transform.scale);
  const scaledHeight = Math.floor(crop.height * transform.scale);

  return [
    // 1. Crop the specified region from the original video
    `crop=${crop.width}:${crop.height}:${crop.x}:${crop.y}`,

    // 2. Scale the cropped region by the transform.scale factor
    `scale=${scaledWidth}:${scaledHeight}`,

    // 3. Pad (position) the scaled region into the final target resolution
    //    at the computed adjustedX and adjustedY offsets
    `pad=${targetWidth}:${targetHeight}:${adjustedX}:${adjustedY}:black`,
  ];
}

function getComplexFilter(crop, transform, targetWidth, targetHeight, virtualWidth, virtualHeight) {
  const adjustedX = Math.floor((transform.position.x / virtualWidth) * targetWidth);
  const adjustedY = Math.floor((transform.position.y / virtualHeight) * targetHeight);

  const scaledWidth = Math.floor(crop.width * transform.scale);
  const scaledHeight = Math.floor(crop.height * transform.scale);

  return [
    // 1. Crop and scale the video
    `[0:v]crop=${crop.width}:${crop.height}:${crop.x}:${crop.y},scale=${scaledWidth}:${scaledHeight}[scaled]`,

    // 2. Create a black background at the target resolution
    `color=black:size=${targetWidth}x${targetHeight}[bg]`,

    // 3. Overlay the scaled video onto the background
    `[bg][scaled]overlay=${adjustedX}:${adjustedY}:shortest=1[out]`
  ];
}

module.exports = { getVideoMetadata, mergeScenes, getFilters, getComplexFilter };
