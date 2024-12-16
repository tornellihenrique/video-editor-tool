const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const bodyParser = require('body-parser');
const cors = require('cors');

const db = require('./db');
const { v4: uuidv4 } = require('uuid');

const { exec, execFile, spawn } = require('child_process');

const os = require('os');

// Detect the operating system
const isWindows = os.platform() === 'win32';
const isLinux = os.platform() === 'linux';
const isMac = os.platform() === 'darwin';

const { mergeScenes, getComplexFilter } = require('./utils.js');

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
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}

const processedPath = path.join(__dirname, 'processed');
if (!fs.existsSync(processedPath)) {
  fs.mkdirSync(processedPath, { recursive: true });
}

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

app.post('/upload-old', upload.single('video'), (req, res) => {
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
    (err, videos) => {
      if (err) {
        console.error('DB select error:', err);
        return res.status(500).json({ error: 'Failed to fetch videos' });
      }

      // Fetch scenes for each video
      const videoPromises = videos.map(video => {
        return new Promise((resolve, reject) => {
          db.all(
            'SELECT id, videoId, start, end, metadata FROM scenes WHERE videoId = ? ORDER BY start ASC',
            [video.id],
            (err, scenes) => {
              if (err) {
                console.error('DB select error (scenes):', err);
                return reject(err);
              }

              // Attach scenes to the video object
              resolve({
                ...video,
                scenes: scenes.map(({ start, end }) => ({ start, end })),
              });
            },
          );
        });
      });

      // Wait for all video-scene mappings to complete
      Promise.all(videoPromises)
        .then(results => {
          res.json(results);
        })
        .catch(fetchError => {
          console.error('Error fetching scenes:', fetchError);
          res.status(500).json({
            error: 'Failed to fetch scenes for videos',
            details: fetchError.message,
          });
        });
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

    // Dynamically set the Python executable path based on the OS
    const pythonExecutable = isWindows
      ? path.join(__dirname, 'venv', 'Scripts', 'python.exe') // Windows
      : path.join(__dirname, 'venv', 'bin', 'python'); // Linux/macOS

    console.log(`Detected OS: ${os.platform()}`);
    console.log(`Using Python executable: ${pythonExecutable}`);

    const scriptPath = path.join(__dirname, 'detect_scenes.py');
    console.log(`Running scene detection for video: ${localFilePath}`);

    execFile(
      pythonExecutable,
      [scriptPath, localFilePath],
      (error, stdout, stderr) => {
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
      },
    );
  } catch (urlError) {
    console.error('Invalid videoPath:', urlError.message);
    return res.status(400).json({ error: 'Invalid videoPath URL' });
  }
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

  const videoDetails = {
    fileUrl,
    originalName: req.file.originalname,
  };

  // Detect OS and set Python executable
  const pythonExecutable = isWindows
    ? path.join(__dirname, 'venv', 'Scripts', 'python.exe') // Windows
    : path.join(__dirname, 'venv', 'bin', 'python'); // Linux/macOS

  const scriptPath = path.join(__dirname, 'detect_scenes.py');
  const localFilePath = path.join(uploadsPath, fileName);

  console.log(`Detected OS: ${os.platform()}`);
  console.log(`Using Python executable: ${pythonExecutable}`);
  console.log(`Running scene detection for video: ${localFilePath}`);

  // Execute Python script for scene detection
  execFile(
    pythonExecutable,
    [scriptPath, localFilePath],
    (error, stdout, stderr) => {
      if (error) {
        console.error('Error running Python script:', error.message);
        console.error('stderr:', stderr);
        return res
          .status(500)
          .json({ error: 'Failed to detect scenes', details: error.message });
      }

      try {
        // Parse the result from the Python script
        const detectedScenes = JSON.parse(stdout);

        // Save video and detected scenes into the database
        db.run(
          `INSERT INTO videos (fileUrl, originalName) VALUES (?, ?)`,
          [videoDetails.fileUrl, videoDetails.originalName],
          function (err) {
            if (err) {
              console.error('DB insert error (video):', err);
              return res
                .status(500)
                .json({ error: 'Failed to store video in database' });
            }

            const videoId = this.lastID; // Get the inserted video ID

            // Save detected scenes in the database
            const sceneInsertPromises = detectedScenes.scenes.map(scene => {
              return new Promise((resolve, reject) => {
                db.run(
                  `INSERT INTO scenes (videoId, start, end, metadata) VALUES (?, ?, ?, ?)`,
                  [
                    videoId,
                    scene.start,
                    scene.end,
                    JSON.stringify(scene.metadata),
                  ],
                  err => {
                    if (err) {
                      console.error('DB insert error (scene):', err);
                      reject(err);
                    } else {
                      resolve();
                    }
                  },
                );
              });
            });

            // Wait for all scenes to be saved
            Promise.all(sceneInsertPromises)
              .then(() => {
                res.status(200).json({
                  id: videoId,
                  fileUrl: videoDetails.fileUrl,
                  originalName: videoDetails.originalName,
                  scenes: detectedScenes.scenes,
                });
              })
              .catch(sceneError => {
                console.error('Error saving scenes:', sceneError);
                res.status(500).json({
                  error: 'Failed to store scenes in database',
                  details: sceneError.message,
                });
              });
          },
        );
      } catch (parseError) {
        console.error('Error parsing script output:', parseError.message);
        res.status(500).json({
          error: 'Failed to process scene data',
          details: parseError.message,
        });
      }
    },
  );
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

    const uniqueId = `${Date.now()}-${uuidv4()}`;
    const outputDir = path.join(__dirname, 'processed', uniqueId);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Function to process each scene
    const processScene = (scene, index) => {
      return new Promise((resolve, reject) => {
        const { start, end, crop, scale, position } = scene;
        const filters = getComplexFilter(
          crop,
          { scale, position },
          targetWidth,
          targetHeight,
          virtualWidth,
          virtualHeight,
        ).join(',');

        const outputPath = path.join(outputDir, `scene_${index + 1}.mp4`);

        const ffmpegArgs = [
          '-y',
          '-i', localFilePath,
          '-filter_complex', filters,
          '-map', '[out]',
          '-map', '0:a?', // Include audio stream if present
          '-ss', start.toString(),
          '-t', (end - start).toString(),
          '-c:v', 'libx264',
          '-crf', '18',
          '-preset', 'slow',
          '-pix_fmt', 'yuv420p',
          '-c:a', 'aac',
          '-b:a', '192k',
          outputPath,
        ];

        const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

        ffmpegProcess.stdout.on('data', data => {
          console.log(`FFmpeg stdout: ${data}`);
        });

        ffmpegProcess.stderr.on('data', data => {
          console.error(`FFmpeg stderr: ${data}`);
        });

        ffmpegProcess.on('close', code => {
          if (code === 0) {
            console.log(`Scene ${index + 1} processed: ${outputPath}`);
            resolve(outputPath);
          } else {
            reject(new Error(`FFmpeg process exited with code ${code}`));
          }
        });
      });
    };

    // Process scenes and merge them
    const processedFiles = await Promise.all(
      scenes.map((scene, index) => processScene(scene, index)),
    );

    const finalOutputPath = path.join(outputDir, `final_${uniqueId}.mp4`);
    await mergeScenes(processedFiles, finalOutputPath);

    res.status(200).json({
      message: 'Video export complete',
      downloadUrl: `${req.protocol}://${req.get('host')}/download/${uniqueId}`,
    });
  } catch (err) {
    console.error('Error processing video:', err.message);
    res
      .status(500)
      .json({ error: 'Failed to process video', details: err.message });
  }
});

app.get('/download/:uniqueId', (req, res) => {
  const { uniqueId } = req.params;
  const filePath = path.join(processedPath, uniqueId, `final_${uniqueId}.mp4`);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.download(filePath, `final_${uniqueId}.mp4`, err => {
    if (err) {
      console.error('Error sending file:', err.message);
    } else {
      console.log(`File sent: ${filePath}`);
    }
  });
});

app.delete('/videos/:id', (req, res) => {
  const videoId = req.params.id;

  // Get the file URL from the database before deletion
  db.get('SELECT fileUrl FROM videos WHERE id = ?', [videoId], (err, row) => {
    if (err) {
      console.error('DB fetch error:', err);
      return res.status(500).json({ error: 'Failed to fetch video details' });
    }

    if (!row) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Parse the URL to extract the filename
    const urlObj = new URL(row.fileUrl);
    const fileName = path.basename(urlObj.pathname);
    const localFilePath = path.join(__dirname, 'uploads', fileName);

    // Delete the video file from the filesystem
    fs.unlink(localFilePath, unlinkErr => {
      if (unlinkErr && unlinkErr.code !== 'ENOENT') {
        console.error('File delete error:', unlinkErr);
        return res.status(500).json({ error: 'Failed to delete video file' });
      }

      // Delete the video and associated scenes from the database
      db.run('DELETE FROM videos WHERE id = ?', [videoId], function (dbErr) {
        if (dbErr) {
          console.error('DB delete error:', dbErr);
          return res
            .status(500)
            .json({ error: 'Failed to delete video from database' });
        }

        res.status(200).json({
          message: 'Video file and its associated data deleted successfully',
        });
      });
    });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
