import cv2
import sys
import json
import os
from moviepy.video.io.VideoFileClip import VideoFileClip

def setup_logger(log_file):
    import logging
    logging.basicConfig(
        filename=log_file,
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        filemode="w"  # Overwrite log file for each run
    )
    return logging.getLogger()

def detect_scenes(video_path, log_file, threshold=30.0, frame_skip=10):
    logger = setup_logger(log_file)

    if not os.path.exists(video_path):
        logger.error(f"Video file '{video_path}' does not exist")
        return {"error": f"Video file '{video_path}' does not exist"}

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        logger.error(f"Failed to open video file '{video_path}'")
        return {"error": f"Failed to open video file '{video_path}'"}

    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    scene_boundaries = [0.0]  # Start of the video
    prev_gray = None
    frame_index = 0

    logger.info(f"Analyzing video: {video_path}")
    logger.info(f"FPS: {fps}, Total Frames: {total_frames}, Frame Skip: {frame_skip}")

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_index % frame_skip == 0:  # Process every `frame_skip` frames
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            if prev_gray is not None:
                diff = cv2.absdiff(gray, prev_gray)
                mean_diff = diff.mean()  # Average intensity difference
                if mean_diff > threshold:
                    current_time = frame_index / fps
                    scene_boundaries.append(current_time)
                    logger.info(f"Scene detected at {current_time:.2f}s (mean_diff={mean_diff:.2f})")
            prev_gray = gray

        if frame_index % (frame_skip * 100) == 0:
            logger.info(f"Processed {frame_index}/{total_frames} frames...")

        frame_index += 1

    cap.release()

    # Ensure the last scene boundary includes the end of the video
    clip = VideoFileClip(video_path)
    duration = clip.duration
    if scene_boundaries[-1] < duration:
        scene_boundaries.append(duration)

    logger.info(f"Scene detection complete. Found {len(scene_boundaries) - 1} scenes.")

    # Generate scenes data
    scenes_data = []
    for i in range(len(scene_boundaries) - 1):
        scenes_data.append({
            "start": scene_boundaries[i],
            "end": scene_boundaries[i + 1]
        })

    return {"scenes": scenes_data}


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No video path provided"}))
        sys.exit(1)

    video_path = sys.argv[1]
    log_file = f"{os.path.splitext(video_path)[0]}_scenes.log"  # Log file name
    result = detect_scenes(video_path, log_file)
    print(json.dumps(result))  # Output JSON for Node.js communication
