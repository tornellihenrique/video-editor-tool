const fs = require('fs');
const path = require('path');
const { exec, execFile, spawn } = require('child_process');

function mergeScenes(intermediateFiles, outputPath) {
  return new Promise((resolve, reject) => {
    const fileListPath = path.join(path.dirname(outputPath), 'file_list.txt');

    // Create a file list for FFmpeg concat
    const fileListContent = intermediateFiles
      .map(filePath => `file '${filePath}'`)
      .join('\n');
    fs.writeFileSync(fileListPath, fileListContent);

    // FFmpeg arguments for merging videos with high quality and audio retention
    const ffmpegArgs = [
      '-y', // Overwrite output files without asking
      '-f', 'concat', // Specify the concat demuxer
      '-safe', '0', // Allow unsafe file paths
      '-i', fileListPath, // Input file list
      '-c:v', 'libx264', // Encode video with H.264 codec
      '-crf', '18', // Set constant rate factor for high quality
      '-preset', 'slow', // Use slow preset for better compression
      '-pix_fmt', 'yuv420p', // Set pixel format for compatibility
      '-c:a', 'aac', // Encode audio with AAC codec
      '-b:a', '192k', // Set audio bitrate
      outputPath, // Output file path
    ];

    const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

    ffmpegProcess.stdout.on('data', data => {
      console.log(`FFmpeg stdout: ${data}`);
    });

    ffmpegProcess.stderr.on('data', data => {
      console.error(`FFmpeg stderr: ${data}`);
    });

    ffmpegProcess.on('close', code => {
      fs.unlinkSync(fileListPath); // Clean up temporary file list
      if (code === 0) {
        console.log('Final video merge complete:', outputPath);
        resolve(outputPath);
      } else {
        reject(new Error(`FFmpeg process exited with code ${code}`));
      }
    });
  });
}

function getComplexFilter(
  crop,
  transform,
  targetWidth,
  targetHeight,
  virtualWidth,
  virtualHeight,
) {
  const adjustedX = Math.floor(
    (transform.position.x / virtualWidth) * targetWidth,
  );
  const adjustedY = Math.floor(
    (transform.position.y / virtualHeight) * targetHeight,
  );

  const scaledWidth = Math.floor(crop.width * transform.scale);
  const scaledHeight = Math.floor(crop.height * transform.scale);

  return [
    // 1. Crop and scale the video
    `[0:v]crop=${crop.width}:${crop.height}:${crop.x}:${crop.y},scale=${scaledWidth}:${scaledHeight}[scaled]`,

    // 2. Create a black background at the target resolution
    `color=black:size=${targetWidth}x${targetHeight}[bg]`,

    // 3. Overlay the scaled video onto the background
    `[bg][scaled]overlay=${adjustedX}:${adjustedY}:shortest=1[out]`,
  ];
}

module.exports = {
  mergeScenes,
  getComplexFilter,
};
