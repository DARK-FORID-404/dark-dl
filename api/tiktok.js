// api/tiktok.js - Complete TikTok Downloader (All in One)
// Includes built-in download helper

const DEVELOPER = {
  name: "DARK FORID",
  github: "https://github.com/DARK-FORID-404"
};

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const videoUrl = url.searchParams.get("url");
  const action = url.searchParams.get("action");

  // =============================================
  // DOWNLOAD ACTION - Download the video
  // =============================================
  if (action === "download") {
    if (!videoUrl) {
      return res.status(400).json({
        success: false,
        error: "Missing video URL for download"
      });
    }

    try {
      // Fetch the video with proper headers (bypass TikTok blocking)
      const response = await fetch(videoUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Referer": "https://www.tiktok.com/",
          "Accept": "video/mp4, video/webm, video/*",
          "Accept-Language": "en-US,en;q=0.9",
          "Connection": "keep-alive",
          "Cache-Control": "no-cache",
          "Pragma": "no-cache"
        }
      });

      if (!response.ok) {
        return res.status(500).json({
          success: false,
          error: "Failed to download video",
          status: response.status
        });
      }

      // Get the video data
      const buffer = await response.arrayBuffer();

      // Set proper headers for download
      res.setHeader("Content-Type", "video/mp4");
      res.setHeader("Content-Disposition", "attachment; filename=tiktok_video.mp4");
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.setHeader("Content-Length", buffer.byteLength);

      // Send the video
      return res.status(200).send(Buffer.from(buffer));

    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message || "Download failed"
      });
    }
  }

  // =============================================
  // INFO ACTION - Get video info only
  // =============================================
  if (action === "info") {
    if (!videoUrl) {
      return res.status(400).json({
        success: false,
        error: "Missing TikTok URL"
      });
    }

    try {
      const result = await getVideoInfo(videoUrl);
      if (!result) {
        return res.status(500).json({
          success: false,
          error: "Could not extract video info"
        });
      }
      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message || "Internal error"
      });
    }
  }

  // =============================================
  // MAIN ACTION - Get video info with download links
  // =============================================
  if (!videoUrl) {
    return res.status(200).json({
      success: true,
      platform: "tiktok",
      message: "TikTok Downloader API - No Watermark",
      usage: {
        "Get video info": "/api/tiktok?url=TIKTOK_URL",
        "Get video info only": "/api/tiktok?url=TIKTOK_URL&action=info",
        "Download video": "/api/tiktok?url=VIDEO_URL&action=download"
      },
      example: {
        "Get info": "/api/tiktok?url=https://vt.tiktok.com/ZS4UgbwFj/",
        "Download": "/api/tiktok?url=https://vt.tiktok.com/ZS4UgbwFj/&action=download"
      },
      developer: DEVELOPER
    });
  }

  try {
    // Get video info
    const videoData = await getVideoInfo(videoUrl);
    
    if (!videoData || !videoData.no_watermark) {
      return res.status(500).json({
        success: false,
        error: "Could not extract video. Try a different TikTok link.",
        message: "Make sure the video is public and the URL is correct",
        developer: DEVELOPER
      });
    }
    
    // Build response with download links
    const baseUrl = `https://${req.headers.host}`;
    const noWatermarkUrl = videoData.no_watermark;
    const withWatermarkUrl = videoData.with_watermark;
    const audioUrl = videoData.music_url;
    
    // Create response
    const response = {
      success: true,
      platform: "tiktok",
      developer: DEVELOPER,
      api_used: videoData.api_used || "tikwm.com",
      result: {
        id: videoData.id,
        title: videoData.title,
        uploader: videoData.uploader,
        duration: videoData.duration,
        thumbnail: videoData.thumbnail,
        medias: {
          no_watermark: {
            quality: "No Watermark (1080p)",
            url: noWatermarkUrl,
            download_url: `${baseUrl}/api/tiktok?url=${encodeURIComponent(noWatermarkUrl)}&action=download`,
            direct_url: noWatermarkUrl
          }
        },
        stats: videoData.stats || {},
        webpage_url: videoUrl,
        how_to_download: {
          method_1: `Use the 'download_url': ${baseUrl}/api/tiktok?url=${encodeURIComponent(noWatermarkUrl)}&action=download`,
          method_2: "Copy the 'direct_url' and paste in your browser",
          method_3: "Right-click the 'direct_url' and select 'Save link as...'"
        }
      }
    };
    
    // Add with_watermark if available
    if (withWatermarkUrl) {
      response.result.medias.with_watermark = {
        quality: "With Watermark",
        url: withWatermarkUrl,
        download_url: `${baseUrl}/api/tiktok?url=${encodeURIComponent(withWatermarkUrl)}&action=download`,
        direct_url: withWatermarkUrl
      };
    }
    
    // Add audio if available
    if (audioUrl) {
      response.result.medias.audio = {
        quality: "Audio",
        url: audioUrl,
        download_url: `${baseUrl}/api/tiktok?url=${encodeURIComponent(audioUrl)}&action=download`,
        direct_url: audioUrl
      };
    }
    
    return res.status(200).json(response);
    
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
      developer: DEVELOPER
    });
  }
}

// =============================================
// HELPER FUNCTION: Get Video Info
// =============================================
async function getVideoInfo(videoUrl) {
  // Try multiple free TikTok APIs
  const apis = [
    // API 1: TikWM (Most reliable)
    {
      url: `https://tikwm.com/api/?url=${encodeURIComponent(videoUrl)}`,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    },
    // API 2: TikMate (Backup)
    {
      url: `https://tikmate.cc/api/?url=${encodeURIComponent(videoUrl)}`,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    }
  ];
  
  let videoData = null;
  let usedApi = "";
  
  // Try each API
  for (const api of apis) {
    try {
      const response = await fetch(api.url, {
        headers: api.headers
      });
      
      if (response.status === 200) {
        const data = await response.json();
        
        // Parse TikWM response
        if (data && data.data && data.data.play) {
          videoData = {
            id: data.data.id || Date.now().toString(),
            title: data.data.title || data.data.desc || "TikTok Video",
            uploader: data.data.author?.unique_id || data.data.author?.nickname || "Unknown",
            duration: data.data.duration || 0,
            thumbnail: data.data.cover || "",
            music_url: data.data.music?.play_url || "",
            no_watermark: data.data.play || "",
            with_watermark: data.data.wmplay || "",
            stats: {
              plays: data.data.play_count || 0,
              likes: data.data.digg_count || 0,
              comments: data.data.comment_count || 0,
              shares: data.data.share_count || 0
            },
            api_used: "tikwm.com"
          };
          usedApi = "tikwm.com";
          break;
        }
        
        // Parse TikMate response
        if (data && data.video) {
          videoData = {
            id: Date.now().toString(),
            title: data.title || "TikTok Video",
            uploader: data.author || "Unknown",
            duration: data.duration || 0,
            thumbnail: data.thumbnail || "",
            music_url: data.music || "",
            no_watermark: data.video || "",
            with_watermark: null,
            stats: {
              plays: 0,
              likes: 0,
              comments: 0,
              shares: 0
            },
            api_used: "tikmate.cc"
          };
          usedApi = "tikmate.cc";
          break;
        }
      }
    } catch (e) {
      continue;
    }
  }
  
  return videoData;
          }
