// Cloudflare Worker - Social Media Downloader API
// 3M requests/month FREE!

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
const PLATFORMS = {
  youtube: /(youtube\.com|youtu\.be)/i,
  facebook: /(facebook\.com|fb\.watch)/i,
  instagram: /instagram\.com/i,
  tiktok: /tiktok\.com/i,
  twitter: /(twitter\.com|x\.com)/i,
  reddit: /reddit\.com/i,
  vimeo: /vimeo\.com/i,
  dailymotion: /dailymotion\.com/i,
  soundcloud: /soundcloud\.com/i,
  twitch: /twitch\.tv/i,
  pinterest: /pinterest\.com/i
};

function detectPlatform(url) {
  for (const [platform, pattern] of Object.entries(PLATFORMS)) {
    if (pattern.test(url)) return platform;
  }
  return "unknown";
}

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
// YouTube Extractor
// =============================================
async function extractYouTube(url) {
  // Extract video ID
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
    // Fetch page
    const pageUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const response = await fetch(pageUrl, {
      headers: {
        "accept-language": "en-US,en;q=0.5",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });
    
    const html = await response.text();
    
    // Get player response
    const match = html.match(/ytInitialPlayerResponse\s*=\s*({.*?});/s);
    if (!match) return null;
    
    const player = JSON.parse(match[1]);
    const vd = player.videoDetails || {};
    const mf = player.microformat?.playerMicroformatRenderer || {};
    
    if (!vd.videoId) return null;

    // Get API key and config
    const keyMatch = html.match(/"INNERTUBE_API_KEY":"(.*?)"/);
    const clientNameMatch = html.match(/"INNERTUBE_CONTEXT_CLIENT_NAME":(\d+)/);
    const clientVersionMatch = html.match(/"INNERTUBE_CONTEXT_CLIENT_VERSION":"(.*?)"/);
    
    const apiKey = keyMatch ? keyMatch[1] : null;
    const clientName = clientNameMatch ? clientNameMatch[1] : null;
    const clientVersion = clientVersionMatch ? clientVersionMatch[1] : null;

    let medias = { audio: [], video: [], combined: [] };
    
    if (apiKey && clientName) {
      // Try multiple clients
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
                quality: fmt.quality,
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
// yt-dlp Fallback for Other Platforms (via external service)
// =============================================
async function extractWithYtdlp(url, format, quality) {
  // Since Cloudflare Workers can't run yt-dlp,
  // we use a free external API or scrape directly
  
  const platform = detectPlatform(url);
  
  // For non-YouTube platforms, try direct scraping
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });
    const html = await response.text();
    
    // Extract video URL from Open Graph
    const videoMatch = html.match(/<meta\s+property="og:video"\s+content="([^"]+)"/i) ||
                      html.match(/<meta\s+property="og:video:url"\s+content="([^"]+)"/i) ||
                      html.match(/<video[^>]*src="([^"]+)"/i);
    
    const titleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i) ||
                       html.match(/<title>([^<]+)<\/title>/i);
    
    const thumbMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
    
    if (videoMatch) {
      return {
        title: titleMatch ? titleMatch[1] : "Video",
        uploader: platform || "Unknown",
        thumbnail: thumbMatch ? thumbMatch[1] : "",
        direct_url: videoMatch[1],
        formats: [
          {
            format_id: "direct",
            ext: "mp4",
            resolution: "720p",
            url: videoMatch[1]
          }
        ]
      };
    }
    return null;
  } catch (error) {
    return null;
  }
}

// =============================================
// Main Handler
// =============================================
async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  
  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
  
  // Handle OPTIONS
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }
  
  // Home route
  if (path === "/" || path === "") {
    return new Response(JSON.stringify({
      success: true,
      message: "DARKz SOCIAL DL API - Cloudflare Worker",
      version: "1.0.0",
      platforms: Object.keys(PLATFORMS),
      developer: DEVELOPER,
      endpoints: {
        "/": "API Status",
        "/api/info": "API Information",
        "/api/download?url=URL": "Download media",
        "/api/download?url=URL&format=audio": "Download audio only",
        "/api/download?url=URL&quality=720": "Filter by quality"
      },
      limits: {
        requests: "3,000,000/month",
        uptime: "24/7"
      }
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  }
  
  // Info route
  if (path === "/api/info") {
    return new Response(JSON.stringify({
      success: true,
      message: "API Info Fetched Successfully",
      developer: DEVELOPER,
      platforms: Object.keys(PLATFORMS),
      worker: {
        runtime: "Cloudflare Workers",
        free_requests: "3,000,000/month"
      }
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  }
  
  // Download route
  if (path === "/api/download") {
    const params = url.searchParams;
    const videoUrl = params.get("url");
    const format = params.get("format") || "video";
    const quality = params.get("quality") || "best";
    
    if (!videoUrl) {
      return new Response(JSON.stringify({
        success: false,
        error: "Missing required param: ?url=",
        developer: DEVELOPER
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }
    
    try {
      const platform = detectPlatform(videoUrl);
      let result = null;
      
      if (platform === "youtube") {
        result = await extractYouTube(videoUrl);
      } else {
        result = await extractWithYtdlp(videoUrl, format, quality);
      }
      
      if (result) {
        // Filter by format if audio
        if (format === "audio" && result.medias) {
          result.medias.video = [];
          result.medias.combined = [];
        }
        
        // Filter by quality
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
        
        return new Response(JSON.stringify({
          success: true,
          platform: platform,
          developer: DEVELOPER,
          requested_format: format,
          requested_quality: quality,
          result
        }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        });
      }
      
      return new Response(JSON.stringify({
        success: false,
        error: "Failed to extract video info. Video may be private, deleted, or region-blocked.",
        developer: DEVELOPER
      }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
      
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: error.message || "Internal server error",
        developer: DEVELOPER
      }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }
  }
  
  // 404
  return new Response(JSON.stringify({
    success: false,
    error: "Endpoint not found",
    available: ["/", "/api/info", "/api/download"],
    developer: DEVELOPER
  }), {
    status: 404,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders
    }
  });
}

// =============================================
// Cloudflare Worker Entry Point
// =============================================
export default {
  fetch: handleRequest
};
