const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const bodyParser = require('body-parser');
const cors = require('cors');

const db = require('./db');
const { v4: uuidv4 } = require('uuid');

const { exec, execFile } = require('child_process');
const ffmpeg = require('fluent-ffmpeg');

const { mergeScenes, getFilters, getComplexFilter } = require('./utils.js');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(
  cors({
    origin: '*',
    credentials: true,
    optionSuccessStatus: 200,
  }),
);

const uploadsPath = path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadsPath));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${uuidv4()}${path.extname(
      file.originalname,
    )}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 3000 * 1024 * 1024 }, // 3 GB max file size
});

app.post('/upload', upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No video file uploaded' });
  }

  // req.protocol gives 'http' or 'https'
  // req.get('host') gives the host (e.g. 'localhost:5000' or 'mydomain.com')
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const fileName = req.file.filename;
  const fileUrl = `${baseUrl}/uploads/${fileName}`;

  db.run(
    `INSERT INTO videos (fileUrl, originalName) VALUES (?, ?)`,
    [fileUrl, req.file.originalname],
    function (err) {
      if (err) {
        console.error('DB insert error:', err);
        return res
          .status(500)
          .json({ error: 'Failed to store video in database' });
      }
      res.status(200).json({
        message: 'File uploaded successfully',
        filePath: fileUrl, // We keep naming as 'filePath' for backward compatibility
      });
    },
  );
});

app.get('/videos', (req, res) => {
  db.all(
    'SELECT id, fileUrl, originalName, createdAt FROM videos ORDER BY createdAt DESC',
    [],
    (err, rows) => {
      if (err) {
        console.error('DB select error:', err);
        return res.status(500).json({ error: 'Failed to fetch videos' });
      }
      res.json(rows);
    },
  );
});

app.post('/detect-scenes', (req, res) => {
  const { videoPath } = req.body;

  if (!videoPath) {
    return res.status(400).json({ error: 'No video path provided' });
  }

  try {
    const fileName = path.basename(new URL(videoPath).pathname);
    const localFilePath = path.join(uploadsPath, fileName);

    const scriptPath = path.join(__dirname, 'detect_scenes.py');
    console.log(`Running scene detection for video: ${localFilePath}`);

    execFile('python', [scriptPath, localFilePath], (error, stdout, stderr) => {
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
  } catch (urlError) {
    console.error('Invalid videoPath:', urlError.message);
    return res.status(400).json({ error: 'Invalid videoPath URL' });
  }
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
    // Parse the URL to extract the filename
    const urlObj = new URL(videoPath);
    const fileName = path.basename(urlObj.pathname);
    const localFilePath = path.join(__dirname, 'uploads', fileName);

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

        ffmpeg(localFilePath)
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
