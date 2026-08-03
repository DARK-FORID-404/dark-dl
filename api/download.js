// api/download.js - Vercel Serverless Function
// Converts your Cloudflare Worker to Vercel

// =============================================
// Developer Information
// =============================================
const DEVELOPER = {
  api_name: "SOCIAL DL - All-in-One Media Downloader API",
  api_version: "1.0.0",
  api_developer: "DARK FORID",
  dev_github: "https://github.com/DARK-FORID-404",
  dev_telegram: "https://t.me/@UnknownXBoyX"
};

// =============================================
// Platform Detection
// =============================================
function detectPlatform(url) {
  if (/(youtube\.com|youtu\.be)/i.test(url)) return "youtube";
  if (/tiktok\.com/i.test(url)) return "tiktok";
  if (/(facebook\.com|fb\.watch)/i.test(url)) return "facebook";
  if (/instagram\.com/i.test(url)) return "instagram";
  return "unknown";
}

// =============================================
// CORS Headers
// =============================================
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

// =============================================
// YouTube Client Configurations
// =============================================
const CLIENTS = {
  ios: {
    clientName: "IOS",
    clientVersion: "19.45.4",
    deviceMake: "Apple",
    deviceModel: "iPhone16,2",
    osName: "iPhone",
    osVersion: "18.1.0.22B83",
    userAgent: "com.google.ios.youtube/19.45.4 (iPhone16,2; U; CPU iOS 18_1_0 like Mac OS X;)",
    hl: "en",
    timeZone: "UTC",
    utcOffsetMinutes: 0
  },
  android_vr: {
    clientName: "ANDROID_VR",
    clientVersion: "1.60.19",
    androidSdkVersion: 32,
    deviceMake: "Oculus",
    deviceModel: "Quest 3",
    osName: "Android",
    osVersion: "12L",
    userAgent: "com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip",
    hl: "en",
    timeZone: "UTC",
    utcOffsetMinutes: 0
  },
  android: {
    clientName: "ANDROID",
    clientVersion: "19.44.38",
    androidSdkVersion: 30,
    osName: "Android",
    osVersion: "11",
    userAgent: "com.google.android.youtube/19.44.38 (Linux; U; Android 11) gzip",
    hl: "en",
    timeZone: "UTC",
    utcOffsetMinutes: 0
  }
};

// =============================================
// YOUTUBE EXTRACTOR
// =============================================
async function extractYouTube(url) {
  const patterns = [
    /(?:v=|\/)([0-9A-Za-z_-]{11})(?:&|$)/,
    /youtu\.be\/([0-9A-Za-z_-]{11})/,
    /embed\/([0-9A-Za-z_-]{11})/
  ];
  
  let videoId = null;
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      videoId = match[1];
      break;
    }
  }
  
  if (!videoId) return null;

  try {
    const pageUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const response = await fetch(pageUrl, {
      headers: {
        "accept-language": "en-US,en;q=0.5",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });
    
    const html = await response.text();
    const match = html.match(/ytInitialPlayerResponse\s*=\s*({.*?});/s);
    if (!match) return null;
    
    const player = JSON.parse(match[1]);
    const vd = player.videoDetails || {};
    const mf = player.microformat?.playerMicroformatRenderer || {};
    
    if (!vd.videoId) return null;

    const keyMatch = html.match(/"INNERTUBE_API_KEY":"(.*?)"/);
    const clientNameMatch = html.match(/"INNERTUBE_CONTEXT_CLIENT_NAME":(\d+)/);
    const clientVersionMatch = html.match(/"INNERTUBE_CONTEXT_CLIENT_VERSION":"(.*?)"/);
    
    const apiKey = keyMatch ? keyMatch[1] : null;
    const clientName = clientNameMatch ? clientNameMatch[1] : null;
    const clientVersion = clientVersionMatch ? clientVersionMatch[1] : null;

    let medias = { audio: [], video: [], combined: [] };
    
    if (apiKey && clientName) {
      const clientTypes = ["ios", "android_vr", "android"];
      for (const ct of clientTypes) {
        const client = CLIENTS[ct];
        const apiUrl = `https://www.youtube.com/youtubei/v1/player?key=${apiKey}`;
        
        const payload = {
          context: { client },
          videoId,
          playbackContext: {
            contentPlaybackContext: {
              html5Preference: "HTML5_PREF_WANTS"
            }
          },
          racyCheckOk: true
        };
        
        try {
          const resp = await fetch(apiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "User-Agent": client.userAgent,
              "X-YouTube-Client-Name": clientName,
              "X-YouTube-Client-Version": clientVersion || ""
            },
            body: JSON.stringify(payload)
          });
          
          if (resp.status === 200) {
            const data = await resp.json();
            const streaming = data?.streamingData || {};
            const formats = [...(streaming.formats || []), ...(streaming.adaptiveFormats || [])];
            
            const audio = [];
            const video = [];
            const combined = [];
            
            for (const fmt of formats) {
              const mime = fmt.mimeType || "";
              const entry = {
                itag: fmt.itag,
                bitrate: fmt.bitrate,
                quality: fmt.qualityLabel || fmt.quality || "720p",
                filesize: parseInt(fmt.contentLength, 10) || 0,
                mimeType: mime,
                url: fmt.url
              };
              
              if (mime.includes("audio") && !mime.includes("video")) {
                audio.push(entry);
              } else if (mime.includes("video") && !mime.includes("audio")) {
                entry.height = fmt.height;
                entry.width = fmt.width;
                entry.fps = fmt.fps;
                video.push(entry);
              } else if (mime.includes("video")) {
                entry.height = fmt.height;
                entry.width = fmt.width;
                combined.push(entry);
              }
            }
            
            audio.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
            video.sort((a, b) => (b.height || 0) - (a.height || 0));
            combined.sort((a, b) => (b.height || 0) - (a.height || 0));
            
            medias = {
              audio: audio.slice(0, 5),
              video: video.slice(0, 10),
              combined: combined.slice(0, 5)
            };
            break;
          }
        } catch (e) {
          continue;
        }
      }
    }

    return {
      id: vd.videoId,
      title: vd.title,
      description: (vd.shortDescription || "").slice(0, 300),
      uploader: vd.author,
      channel_id: vd.channelId,
      channel_url: mf.ownerProfileUrl,
      duration_seconds: parseInt(vd.lengthSeconds, 10) || 0,
      view_count: parseInt(vd.viewCount, 10) || 0,
      is_live: vd.isLiveContent || false,
      upload_date: mf.uploadDate,
      publish_date: mf.publishDate,
      category: mf.category,
      webpage_url: `https://www.youtube.com/watch?v=${vd.videoId}`,
      thumbnail: `https://img.youtube.com/vi/${vd.videoId}/maxresdefault.jpg`,
      medias
    };
  } catch (error) {
    return null;
  }
}

// =============================================
// TIKTOK EXTRACTOR
// =============================================
async function extractTikTok(url) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });
    const html = await response.text();
    
    let videoUrl = "";
    let title = "TikTok Video";
    let author = "Unknown";
    let thumbnail = "";
    let duration = 0;
    
    const videoPatterns = [
      /"videoUrl":"([^"]+)"/,
      /"playAddr":"([^"]+)"/,
      /"downloadAddr":"([^"]+)"/,
      /<video[^>]*src="([^"]+)"/,
      /src="([^"]*\.mp4[^"]*)"/
    ];
    
    for (const pattern of videoPatterns) {
      const match = html.match(pattern);
      if (match) {
        videoUrl = match[1].replace(/\\/g, "");
        break;
      }
    }
    
    const thumbMatch = html.match(/<meta property="og:image" content="([^"]+)"/) ||
                       html.match(/"cover":"([^"]+)"/);
    if (thumbMatch) {
      thumbnail = thumbMatch[1];
    }
    
    const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/) ||
                       html.match(/<title>([^<]+)<\/title>/);
    if (titleMatch) {
      title = titleMatch[1].replace(/\s*\|\s*TikTok$/, "");
    }
    
    const authorMatch = html.match(/@([a-zA-Z0-9_\.]+)/) ||
                        html.match(/"uniqueId":"([^"]+)"/);
    if (authorMatch) {
      author = authorMatch[1];
    }
    
    const durationMatch = html.match(/"duration":(\d+)/);
    if (durationMatch) {
      duration = parseInt(durationMatch[1]);
    }
    
    if (!videoUrl) return null;
    
    return {
      id: Date.now().toString(),
      title: title,
      uploader: author,
      duration_seconds: duration,
      thumbnail: thumbnail,
      webpage_url: url,
      medias: {
        video: [{ quality: "720p", url: videoUrl }],
        audio: []
      }
    };
  } catch (error) {
    return null;
  }
}

// =============================================
// FACEBOOK EXTRACTOR
// =============================================
async function extractFacebook(url) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });
    const html = await response.text();
    
    const videoUrls = [];
    const patterns = [
      /"playable_url":"([^"]+)"/g,
      /"playable_url_quality_hd":"([^"]+)"/g,
      /"playable_url_quality_sd":"([^"]+)"/g,
      /"hd_src":"([^"]+)"/g,
      /"sd_src":"([^"]+)"/g,
      /<video[^>]*src="([^"]*\.mp4[^"]*)"/gi
    ];
    
    for (const pattern of patterns) {
      const matches = html.matchAll(pattern);
      for (const match of matches) {
        const urlStr = match[1].replace(/\\/g, "");
        if (urlStr.startsWith("http") && !videoUrls.includes(urlStr)) {
          videoUrls.push(urlStr);
        }
      }
    }
    
    if (videoUrls.length === 0) return null;
    
    const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/) ||
                       html.match(/<title>([^<]+)<\/title>/);
    
    const thumbMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
    
    const videos = videoUrls.map((u, i) => ({
      quality: i === 0 ? "HD" : "SD",
      url: u
    }));
    
    return {
      id: Date.now().toString(),
      title: titleMatch ? titleMatch[1].replace(/ \| Facebook$/, "") : "Facebook Video",
      uploader: "Facebook User",
      duration_seconds: 0,
      thumbnail: thumbMatch ? thumbMatch[1] : "",
      webpage_url: url,
      medias: { video: videos, audio: [] }
    };
  } catch (error) {
    return null;
  }
}

// =============================================
// INSTAGRAM EXTRACTOR
// =============================================
async function extractInstagram(url) {
  try {
    const oembedUrl = `https://api.instagram.com/oembed?url=${encodeURIComponent(url)}`;
    const oembedResp = await fetch(oembedUrl);
    let title = "Instagram Post";
    let thumbnail = "";
    let author = "Unknown";
    
    if (oembedResp.status === 200) {
      const data = await oembedResp.json();
      title = data.title || title;
      thumbnail = data.thumbnail_url || thumbnail;
      author = data.author_name || author;
    }
    
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });
    const html = await response.text();
    
    let videoUrl = "";
    
    const videoPatterns = [
      /<meta property="og:video" content="([^"]+)"/,
      /<meta property="og:video:url" content="([^"]+)"/,
      /"video_url":"([^"]+)"/,
      /"video_versions":\[\{"url":"([^"]+)"/
    ];
    
    for (const pattern of videoPatterns) {
      const match = html.match(pattern);
      if (match) {
        videoUrl = match[1].replace(/\\/g, "");
        break;
      }
    }
    
    if (!videoUrl) {
      const imgMatch = html.match(/<meta property="og:image" content="([^"]+)"/) ||
                       html.match(/"display_url":"([^"]+)"/);
      if (imgMatch) {
        thumbnail = imgMatch[1].replace(/\\/g, "");
      }
    }
    
    const authorMatch = html.match(/@([a-zA-Z0-9_\.]+)/);
    if (authorMatch) {
      author = authorMatch[1];
    }
    
    const videos = [];
    if (videoUrl) {
      videos.push({ quality: "720p", url: videoUrl });
    } else if (thumbnail) {
      videos.push({ quality: "image", url: thumbnail });
    } else {
      return null;
    }
    
    return {
      id: Date.now().toString(),
      title: title,
      uploader: author,
      duration_seconds: 0,
      thumbnail: thumbnail,
      webpage_url: url,
      medias: { video: videos, audio: [] }
    };
  } catch (error) {
    return null;
  }
}

// =============================================
// UNIVERSAL EXTRACTOR
// =============================================
async function extractUniversal(url, format, quality) {
  const platform = detectPlatform(url);
  let result = null;
  
  if (platform === "youtube") {
    result = await extractYouTube(url);
  } else if (platform === "tiktok") {
    result = await extractTikTok(url);
  } else if (platform === "facebook") {
    result = await extractFacebook(url);
  } else if (platform === "instagram") {
    result = await extractInstagram(url);
  }
  
  if (!result) return null;
  
  if (format === "audio" && result.medias) {
    result.medias.video = [];
  }
  
  if (quality !== "best" && quality !== "worst" && result.medias && result.medias.video) {
    const targetHeight = parseInt(quality) || 720;
    result.medias.video = result.medias.video.filter(v => {
      const height = v.height || parseInt(v.quality) || 0;
      return height <= targetHeight;
    });
    if (result.medias.video.length > 1) {
      result.medias.video.sort((a, b) => {
        const ah = Math.abs((a.height || parseInt(a.quality) || 0) - targetHeight);
        const bh = Math.abs((b.height || parseInt(b.quality) || 0) - targetHeight);
        return ah - bh;
      });
      result.medias.video = [result.medias.video[0]];
    }
  }
  
  return result;
}

// =============================================
// MAIN HANDLER - Vercel Serverless Function
// =============================================
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
  // Handle OPTIONS
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;
  
  // Home route
  if (path === "/api/download" || path === "/api/") {
    const videoUrl = url.searchParams.get("url");
    const format = url.searchParams.get("format") || "video";
    const quality = url.searchParams.get("quality") || "best";
    
    if (!videoUrl) {
      return res.status(400).json({
        success: false,
        error: "Missing required param: ?url=",
        usage: "/api/download?url=VIDEO_URL&format=video|audio&quality=best|480|720|1080",
        developer: DEVELOPER
      });
    }
    
    try {
      const startTime = Date.now();
      const result = await extractUniversal(videoUrl, format, quality);
      const elapsed = Date.now() - startTime;
      
      if (!result) {
        return res.status(500).json({
          success: false,
          error: "Failed to extract media. Video may be private, deleted, or region-blocked.",
          platform: detectPlatform(videoUrl),
          developer: DEVELOPER
        });
      }
      
      return res.status(200).json({
        success: true,
        platform: detectPlatform(videoUrl),
        developer: DEVELOPER,
        requested_format: format,
        requested_quality: quality,
        processing_time: `${elapsed}ms`,
        result
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message || "Internal server error",
        platform: detectPlatform(videoUrl),
        developer: DEVELOPER
      });
    }
  }
  
  // Info route
  if (path === "/api/info") {
    return res.status(200).json({
      success: true,
      message: "API Info Fetched Successfully",
      developer: DEVELOPER,
      platforms: ["YouTube", "TikTok", "Facebook", "Instagram"],
      platform: "Vercel Serverless",
      limits: {
        requests: "100,000/month",
        uptime: "24/7"
      }
    });
  }
  
  // Raw URL route
  if (path === "/api/raw") {
    const videoUrl = url.searchParams.get("url");
    if (!videoUrl) {
      return res.status(400).json({
        success: false,
        error: "Missing required param: ?url="
      });
    }
    
    try {
      const result = await extractUniversal(videoUrl, "video", "best");
      if (!result) {
        return res.status(500).json({
          success: false,
          error: "Failed to extract media"
        });
      }
      
      const urls = [];
      if (result.medias && result.medias.video) {
        for (const v of result.medias.video) {
          urls.push(v.url);
        }
      }
      
      return res.status(200).json({
        success: true,
        platform: detectPlatform(videoUrl),
        title: result.title || "Unknown",
        urls: urls,
        thumbnail: result.thumbnail || ""
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message || "Internal server error"
      });
    }
  }
  
  // 404
  return res.status(404).json({
    success: false,
    error: "Endpoint not found",
    available: ["/api/download", "/api/info", "/api/raw"],
    developer: DEVELOPER
  });
          }
