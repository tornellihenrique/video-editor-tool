const express = require('express');
const multer = require('multer');
const path = require('path');
const bodyParser = require('body-parser');
const { exec, execFile } = require('child_process');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');

const { mergeScenes, getFilters, getComplexFilter } = require('./utils.js');

const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname); // Extract the file extension
    cb(null, `${Date.now()}${extension}`); // Save with a timestamp and original extension
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB max file size
});

// Upload endpoint
app.post('/upload', upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No video file uploaded' });
  }

  const uploadedPath = path.join(__dirname, req.file.path);
  res.status(200).json({
    message: 'File uploaded successfully',
    filePath: uploadedPath,
  });
});

app.post('/detect-scenes', (req, res) => {
  const { videoPath } = req.body;

  if (!videoPath) {
    return res.status(400).json({ error: 'No video path provided' });
  }

  const scriptPath = path.join(__dirname, 'detect_scenes.py');

  console.log(`Running scene detection for video: ${videoPath}`);
  execFile('python', [scriptPath, videoPath], (error, stdout, stderr) => {
    if (error) {
      console.error('Error running Python script:', error.message);
      console.error('stderr:', stderr);
      return res
        .status(500)
        .json({ error: 'Failed to detect scenes', details: error.message });
    }

    try {
      const result = JSON.parse(stdout);
      if (result.error) {
        return res.status(400).json(result);
      }

      res.status(200).json(result);
    } catch (parseError) {
      console.error('Error parsing script output:', parseError.message);
      res.status(500).json({
        error: 'Failed to process scene data',
        details: parseError.message,
      });
    }
  });
});

app.post('/export', async (req, res) => {
  const {
    videoPath,
    scenes,
    targetAspectRatio,
    targetResolution,
    virtualResolution,
  } = req.body;

  if (
    !videoPath ||
    !scenes ||
    !Array.isArray(scenes) ||
    !targetAspectRatio ||
    !targetResolution
  ) {
    return res
      .status(400)
      .json({ error: 'Invalid request. Missing required parameters.' });
  }

  try {
    const [targetWidth, targetHeight] = targetResolution.split('x').map(Number);
    const [virtualWidth, virtualHeight] = (virtualResolution || '1080x1920')
      .split('x')
      .map(Number);

    const outputDir = path.join(__dirname, 'processed');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }

    const processScene = (scene, index) => {
      return new Promise((resolve, reject) => {
        const { start, end, crop, transform } = scene;
        const complexFilter = getComplexFilter(
          crop,
          transform,
          targetWidth,
          targetHeight,
          virtualWidth,
          virtualHeight,
        );
        const outputPath = path.join(outputDir, `scene_${index + 1}.mp4`);

        ffmpeg(videoPath)
          // Apply complex filter
          .complexFilter(complexFilter)
          // Map the final output stream to the output file
          .map('[out]')
          .setStartTime(start)
          .setDuration(end - start)
          .output(outputPath)
          .on('start', commandLine => {
            console.log(
              `FFmpeg command for scene ${index + 1}: ${commandLine}`,
            );
          })
          .on('end', () => {
            console.log(`Scene ${index + 1} processed: ${outputPath}`);
            resolve(outputPath);
          })
          .on('error', (err, stdout, stderr) => {
            console.error(`Error processing scene ${index + 1}:`, err.message);
            console.error('FFmpeg stdout:', stdout);
            console.error('FFmpeg stderr:', stderr);
            reject(
              new Error(`Failed to process scene ${index + 1}: ${err.message}`),
            );
          })
          .run();
      });
    };

    // Process scenes and merge them
    Promise.all(scenes.map((scene, index) => processScene(scene, index)))
      .then(processedFiles => {
        const finalOutputPath = path.join(outputDir, 'final_video.mp4');
        mergeScenes(processedFiles, finalOutputPath)
          .then(() => {
            res.status(200).json({
              message: 'Video export complete',
              file: finalOutputPath,
            });
          })
          .catch(mergeError => {
            console.error('Error merging videos:', mergeError.message);
            res.status(500).json({
              error: 'Failed to merge videos',
              details: mergeError.message,
            });
          });
      })
      .catch(err => {
        console.error('Error processing scenes:', err.message);
        res
          .status(500)
          .json({ error: 'Failed to process scenes', details: err.message });
      });
  } catch (err) {
    console.error('Error validating video or processing scenes:', err.message);
    res
      .status(500)
      .json({ error: 'Failed to process video', details: err.message });
  }
});

app.get('/processed/:filename', (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(__dirname, 'processed', filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.download(filePath);
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
