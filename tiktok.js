// api/tiktok.js - TikTok Only
// No watermark download

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

  if (!videoUrl) {
    return res.status(200).json({
      success: true,
      platform: "tiktok",
      message: "TikTok Downloader API - No Watermark",
      usage: "/api/tiktok?url=TIKTOK_URL",
      developer: DEVELOPER
    });
  }

  try {
    const response = await fetch(videoUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });
    const html = await response.text();
    
    let videoUrlNoWatermark = "";
    let videoUrlWithWatermark = "";
    let title = "TikTok Video";
    let author = "Unknown";
    let thumbnail = "";
    let duration = 0;
    let musicUrl = "";
    
    // Try to find data in script tags
    const scriptMatch = html.match(/<script[^>]*id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
    
    if (scriptMatch) {
      try {
        const jsonData = JSON.parse(scriptMatch[1]);
        if (jsonData?.__DEFAULT_SCOPE__) {
          const scope = jsonData.__DEFAULT_SCOPE__;
          const data = scope['webapp.video-detail'] || scope['VideoDetail'] || {};
          
          if (data.itemInfo?.itemStruct) {
            const item = data.itemInfo.itemStruct;
            videoUrlNoWatermark = item.video?.playAddr || item.video?.downloadAddr || "";
            videoUrlWithWatermark = item.video?.playAddr || item.video?.downloadAddr || "";
            thumbnail = item.video?.cover || item.video?.dynamicCover || "";
            title = item.desc || title;
            author = item.author?.uniqueId || author;
            duration = item.video?.duration || 0;
            musicUrl = item.music?.playUrl || "";
          } else if (data.videoData) {
            const item = data.videoData;
            videoUrlNoWatermark = item.video?.playAddr || item.video?.downloadAddr || "";
            videoUrlWithWatermark = item.video?.playAddr || item.video?.downloadAddr || "";
            thumbnail = item.video?.cover || "";
            title = item.desc || title;
            author = item.author?.uniqueId || author;
            duration = item.video?.duration || 0;
            musicUrl = item.music?.playUrl || "";
          }
        }
      } catch (e) {}
    }
    
    // If JSON failed, try regex
    if (!videoUrlNoWatermark) {
      const patterns = [
        /"videoUrl":"([^"]+)"/,
        /"playAddr":"([^"]+)"/,
        /"downloadAddr":"([^"]+)"/
      ];
      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match) {
          videoUrlNoWatermark = match[1].replace(/\\/g, "");
          break;
        }
      }
    }
    
    // Get thumbnail
    if (!thumbnail) {
      const thumbMatch = html.match(/<meta property="og:image" content="([^"]+)"/) ||
                         html.match(/"cover":"([^"]+)"/);
      if (thumbMatch) thumbnail = thumbMatch[1];
    }
    
    // Get title
    if (title === "TikTok Video") {
      const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/) ||
                         html.match(/<title>([^<]+)<\/title>/);
      if (titleMatch) title = titleMatch[1].replace(/\s*\|\s*TikTok$/, "").trim();
    }
    
    // Get author
    if (author === "Unknown") {
      const authorMatch = html.match(/@([a-zA-Z0-9_\.]+)/) ||
                          html.match(/"uniqueId":"([^"]+)"/);
      if (authorMatch) author = authorMatch[1];
    }
    
    if (!videoUrlNoWatermark) {
      return res.status(500).json({
        success: false,
        error: "Could not extract video URL"
      });
    }
    
    return res.status(200).json({
      success: true,
      platform: "tiktok",
      developer: DEVELOPER,
      result: {
        title: title,
        uploader: author,
        duration: duration,
        thumbnail: thumbnail,
        music_url: musicUrl,
        medias: {
          no_watermark: {
            quality: "No Watermark",
            url: videoUrlNoWatermark
          },
          with_watermark: videoUrlWithWatermark ? {
            quality: "With Watermark",
            url: videoUrlWithWatermark
          } : null
        },
        webpage_url: videoUrl
      }
    });
    
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error"
    });
  }
}
