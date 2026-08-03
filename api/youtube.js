// api/youtube.js - YouTube Only
// High quality up to 8K

const DEVELOPER = {
  name: "DARK FORID",
  github: "https://github.com/DARK-FORID-404"
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const videoUrl = url.searchParams.get("url");
  const quality = url.searchParams.get("quality") || "best";

  if (!videoUrl) {
    return res.status(200).json({
      success: true,
      platform: "youtube",
      message: "YouTube Downloader API",
      usage: "/api/youtube?url=YOUTUBE_URL&quality=best|480|720|1080|1440|2160",
      developer: DEVELOPER
    });
  }

  try {
    const match = videoUrl.match(/(?:v=|\/)([0-9A-Za-z_-]{11})(?:&|$)/) || 
                  videoUrl.match(/youtu\.be\/([0-9A-Za-z_-]{11})/);
    if (!match) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid YouTube URL" 
      });
    }
    
    const id = match[1];
    const pageUrl = `https://www.youtube.com/watch?v=${id}`;
    const response = await fetch(pageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });
    
    const html = await response.text();
    const playerMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.*?});/s);
    if (!playerMatch) {
      return res.status(500).json({ 
        success: false, 
        error: "Could not extract video data" 
      });
    }
    
    const player = JSON.parse(playerMatch[1]);
    const vd = player.videoDetails || {};
    const streaming = player.streamingData || {};
    const formats = [...(streaming.formats || []), ...(streaming.adaptiveFormats || [])];
    
    const videos = [];
    const audios = [];
    
    for (const fmt of formats) {
      if (fmt.url) {
        const mime = fmt.mimeType || "";
        if (mime.includes("video") && !mime.includes("audio")) {
          videos.push({
            quality: fmt.qualityLabel || fmt.quality || "720p",
            url: fmt.url,
            height: fmt.height || 0,
            width: fmt.width || 0,
            bitrate: fmt.bitrate || 0,
            fps: fmt.fps || 0,
            mimeType: mime
          });
        }
        if (mime.includes("audio") && !mime.includes("video")) {
          audios.push({
            quality: "audio",
            url: fmt.url,
            bitrate: fmt.bitrate || 0,
            mimeType: mime
          });
        }
      }
    }
    
    // Sort by quality (highest first)
    videos.sort((a, b) => (b.height || 0) - (a.height || 0));
    audios.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
    
    // Filter by quality if specified
    let filteredVideos = videos;
    if (quality !== "best") {
      const targetHeight = parseInt(quality) || 720;
      filteredVideos = videos.filter(v => (v.height || 0) <= targetHeight);
      if (filteredVideos.length === 0) filteredVideos = videos.slice(0, 1);
    }
    
    // Get best quality
    const bestVideo = filteredVideos.length > 0 ? filteredVideos[0] : null;
    const bestAudio = audios.length > 0 ? audios[0] : null;
    
    return res.status(200).json({
      success: true,
      platform: "youtube",
      developer: DEVELOPER,
      result: {
        id: vd.videoId || id,
        title: vd.title || "YouTube Video",
        uploader: vd.author || "Unknown",
        duration: parseInt(vd.lengthSeconds, 10) || 0,
        viewCount: parseInt(vd.viewCount, 10) || 0,
        thumbnail: `https://img.youtube.com/vi/${id}/maxresdefault.jpg`,
        webpage_url: `https://www.youtube.com/watch?v=${id}`,
        requested_quality: quality,
        medias: {
          video: filteredVideos.slice(0, 5),
          audio: audios.slice(0, 2),
          best_video: bestVideo,
          best_audio: bestAudio
        }
      }
    });
    
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error"
    });
  }
                      }
