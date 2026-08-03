// api/download.js - Vercel Serverless Function
// Fixed YouTube + Platform-Specific Features

const DEVELOPER = {
  api_name: "SOCIAL DL - All-in-One Media Downloader API",
  api_version: "2.0.0",
  api_developer: "DARK FORID",
  dev_github: "https://github.com/DARK-FORID-404",
  dev_telegram: "https://t.me/@UnknownXBoyX"
};

function detectPlatform(url) {
  if (/(youtube\.com|youtu\.be)/i.test(url)) return "youtube";
  if (/tiktok\.com/i.test(url)) return "tiktok";
  if (/(facebook\.com|fb\.watch)/i.test(url)) return "facebook";
  if (/instagram\.com/i.test(url)) return "instagram";
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
// FIXED YOUTUBE EXTRACTOR - High Quality
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
    // Method 1: Get from YouTube page
    const pageUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const response = await fetch(pageUrl, {
      headers: {
        "accept-language": "en-US,en;q=0.5",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    
    const html = await response.text();
    const match = html.match(/ytInitialPlayerResponse\s*=\s*({.*?});/s);
    if (!match) return null;
    
    const player = JSON.parse(match[1]);
    const vd = player.videoDetails || {};
    const mf = player.microformat?.playerMicroformatRenderer || {};
    
    if (!vd.videoId) return null;

    // Get streaming data directly from player response
    const streaming = player.streamingData || {};
    const formats = streaming.formats || [];
    const adaptiveFormats = streaming.adaptiveFormats || [];
    const allFormats = [...formats, ...adaptiveFormats];
    
    const videoQualities = [];
    const audioQualities = [];
    const combinedQualities = [];
    
    // Sort and categorize formats
    for (const fmt of allFormats) {
      const mime = fmt.mimeType || "";
      const bitrate = fmt.bitrate || 0;
      
      // High quality video
      if (mime.includes("video") && !mime.includes("audio")) {
        const height = fmt.height || 0;
        videoQualities.push({
          itag: fmt.itag,
          quality: fmt.qualityLabel || fmt.quality || `${height}p`,
          url: fmt.url,
          height: height,
          width: fmt.width || 0,
          bitrate: bitrate,
          mimeType: mime,
          fps: fmt.fps || 0
        });
      }
      
      // Audio only
      if (mime.includes("audio") && !mime.includes("video")) {
        audioQualities.push({
          itag: fmt.itag,
          quality: "audio",
          url: fmt.url,
          bitrate: bitrate,
          mimeType: mime
        });
      }
      
      // Combined video + audio
      if (mime.includes("video") && mime.includes("audio")) {
        const height = fmt.height || 0;
        combinedQualities.push({
          itag: fmt.itag,
          quality: fmt.qualityLabel || `${height}p`,
          url: fmt.url,
          height: height,
          width: fmt.width || 0,
          bitrate: bitrate,
          mimeType: mime
        });
      }
    }
    
    // Sort by quality (highest first)
    videoQualities.sort((a, b) => (b.height || 0) - (a.height || 0));
    combinedQualities.sort((a, b) => (b.height || 0) - (a.height || 0));
    audioQualities.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
    
    // Get highest quality video
    const bestVideo = videoQualities.length > 0 ? videoQualities[0] : null;
    const bestCombined = combinedQualities.length > 0 ? combinedQualities[0] : null;
    
    // Get best audio
    const bestAudio = audioQualities.length > 0 ? audioQualities[0] : null;
    
    // If no formats found, try alternative method
    if (videoQualities.length === 0 && combinedQualities.length === 0) {
      // Try to get from innerTube API
      const keyMatch = html.match(/"INNERTUBE_API_KEY":"(.*?)"/);
      const clientNameMatch = html.match(/"INNERTUBE_CONTEXT_CLIENT_NAME":(\d+)/);
      const clientVersionMatch = html.match(/"INNERTUBE_CONTEXT_CLIENT_VERSION":"(.*?)"/);
      
      const apiKey = keyMatch ? keyMatch[1] : null;
      const clientName = clientNameMatch ? clientNameMatch[1] : null;
      const clientVersion = clientVersionMatch ? clientVersionMatch[1] : null;
      
      if (apiKey && clientName) {
        const clientTypes = ["android", "ios"];
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
              const streamingData = data?.streamingData || {};
              const fmtList = streamingData.formats || [];
              const adaptiveFmtList = streamingData.adaptiveFormats || [];
              const allFmts = [...fmtList, ...adaptiveFmtList];
              
              for (const fmt of allFmts) {
                const mime = fmt.mimeType || "";
                if (mime.includes("video") && fmt.url) {
                  videoQualities.push({
                    itag: fmt.itag,
                    quality: fmt.qualityLabel || fmt.quality || "720p",
                    url: fmt.url,
                    height: fmt.height || 0,
                    width: fmt.width || 0,
                    bitrate: fmt.bitrate || 0,
                    mimeType: mime
                  });
                }
                if (mime.includes("audio") && fmt.url) {
                  audioQualities.push({
                    itag: fmt.itag,
                    quality: "audio",
                    url: fmt.url,
                    bitrate: fmt.bitrate || 0,
                    mimeType: mime
                  });
                }
              }
              
              videoQualities.sort((a, b) => (b.height || 0) - (a.height || 0));
              break;
            }
          } catch (e) {
            continue;
          }
        }
      }
    }
    
    // If still no formats, try direct URL
    if (videoQualities.length === 0 && combinedQualities.length === 0) {
      // Generate direct YouTube URL
      const directUrl = `https://www.youtube.com/watch?v=${videoId}`;
      return {
        id: vd.videoId || videoId,
        title: vd.title || "YouTube Video",
        uploader: vd.author || "Unknown",
        duration_seconds: parseInt(vd.lengthSeconds, 10) || 0,
        thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        webpage_url: directUrl,
        medias: {
          video: [{
            quality: "720p",
            url: directUrl,
            note: "Open in browser or use YouTube downloader"
          }]
        }
      };
    }
    
    // Build final result
    const medias = {
      video: [],
      audio: [],
      combined: []
    };
    
    // Add video qualities (top 5)
    if (videoQualities.length > 0) {
      medias.video = videoQualities.slice(0, 5).map(v => ({
        itag: v.itag,
        quality: v.quality,
        url: v.url,
        height: v.height,
        width: v.width,
        bitrate: v.bitrate,
        mimeType: v.mimeType,
        fps: v.fps || 30
      }));
    }
    
    // Add combined qualities (top 3)
    if (combinedQualities.length > 0) {
      medias.combined = combinedQualities.slice(0, 3).map(v => ({
        itag: v.itag,
        quality: v.quality,
        url: v.url,
        height: v.height,
        width: v.width,
        bitrate: v.bitrate,
        mimeType: v.mimeType
      }));
    }
    
    // Add audio (top 2)
    if (audioQualities.length > 0) {
      medias.audio = audioQualities.slice(0, 2).map(a => ({
        itag: a.itag,
        quality: a.quality,
        url: a.url,
        bitrate: a.bitrate,
        mimeType: a.mimeType
      }));
    }

    return {
      id: vd.videoId || videoId,
      title: vd.title || "YouTube Video",
      description: (vd.shortDescription || "").slice(0, 300),
      uploader: vd.author || "Unknown",
      channel_id: vd.channelId || "",
      channel_url: mf.ownerProfileUrl || "",
      duration_seconds: parseInt(vd.lengthSeconds, 10) || 0,
      view_count: parseInt(vd.viewCount, 10) || 0,
      is_live: vd.isLiveContent || false,
      upload_date: mf.uploadDate || "",
      thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      webpage_url: `https://www.youtube.com/watch?v=${videoId}`,
      medias
    };
  } catch (error) {
    // Fallback: return video page URL
    const videoId = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/);
    if (videoId) {
      return {
        id: videoId[1],
        title: "YouTube Video",
        uploader: "Unknown",
        duration_seconds: 0,
        thumbnail: `https://img.youtube.com/vi/${videoId[1]}/maxresdefault.jpg`,
        webpage_url: `https://www.youtube.com/watch?v=${videoId[1]}`,
        medias: {
          video: [{
            quality: "720p",
            url: `https://www.youtube.com/watch?v=${videoId[1]}`,
            note: "Open in browser"
          }]
        }
      };
    }
    return null;
  }
}

// =============================================
// TIKTOK EXTRACTOR - NO WATERMARK
// =============================================
async function extractTikTok(url) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    const html = await response.text();
    
    let videoUrl = "";
    let noWatermarkUrl = "";
    let title = "TikTok Video";
    let author = "Unknown";
    let thumbnail = "";
    let duration = 0;
    let musicUrl = "";
    
    // Try to find video data in script tags
    const scriptMatch = html.match(/<script[^>]*id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
    let videoData = null;
    
    if (scriptMatch) {
      try {
        const jsonData = JSON.parse(scriptMatch[1]);
        if (jsonData && jsonData.__DEFAULT_SCOPE__) {
          const scope = jsonData.__DEFAULT_SCOPE__;
          if (scope['webapp.video-detail']) {
            videoData = scope['webapp.video-detail'];
          } else if (scope['VideoDetail']) {
            videoData = scope['VideoDetail'];
          }
        }
      } catch (e) {}
    }
    
    if (videoData) {
      // Parse from JSON data
      if (videoData.itemInfo && videoData.itemInfo.itemStruct) {
        const item = videoData.itemInfo.itemStruct;
        // No watermark video (best quality)
        noWatermarkUrl = item.video?.playAddr || item.video?.downloadAddr || "";
        videoUrl = item.video?.playAddr || item.video?.downloadAddr || "";
        thumbnail = item.video?.cover || item.video?.dynamicCover || "";
        title = item.desc || title;
        author = item.author?.uniqueId || author;
        duration = item.video?.duration || 0;
        musicUrl = item.music?.playUrl || "";
      } else if (videoData.videoData) {
        const item = videoData.videoData;
        noWatermarkUrl = item.video?.playAddr || item.video?.downloadAddr || "";
        videoUrl = item.video?.playAddr || item.video?.downloadAddr || "";
        thumbnail = item.video?.cover || "";
        title = item.desc || title;
        author = item.author?.uniqueId || author;
        duration = item.video?.duration || 0;
        musicUrl = item.music?.playUrl || "";
      }
    }
    
    // If JSON parsing failed, try regex patterns
    if (!videoUrl) {
      const patterns = [
        /"videoUrl":"([^"]+)"/,
        /"playAddr":"([^"]+)"/,
        /"downloadAddr":"([^"]+)"/,
        /<video[^>]*src="([^"]+)"/,
        /src="([^"]*\.mp4[^"]*)"/
      ];
      
      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match) {
          videoUrl = match[1].replace(/\\/g, "");
          noWatermarkUrl = videoUrl;
          break;
        }
      }
      
      // Try to find no watermark specifically
      const noWmMatch = html.match(/"playAddr":"([^"]+)"/) || 
                        html.match(/"downloadAddr":"([^"]+)"/);
      if (noWmMatch) {
        noWatermarkUrl = noWmMatch[1].replace(/\\/g, "");
      }
    }
    
    // Get thumbnail
    const thumbMatch = html.match(/<meta property="og:image" content="([^"]+)"/) ||
                       html.match(/"cover":"([^"]+)"/);
    if (thumbMatch) {
      thumbnail = thumbMatch[1];
    }
    
    // Get title
    const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/) ||
                       html.match(/<title>([^<]+)<\/title>/);
    if (titleMatch) {
      title = titleMatch[1].replace(/\s*\|\s*TikTok$/, "").trim();
    }
    
    // Get author
    const authorMatch = html.match(/@([a-zA-Z0-9_\.]+)/) ||
                        html.match(/"uniqueId":"([^"]+)"/);
    if (authorMatch) {
      author = authorMatch[1];
    }
    
    // Get duration
    const durationMatch = html.match(/"duration":(\d+)/);
    if (durationMatch) {
      duration = parseInt(durationMatch[1]);
    }
    
    // If we have either video URL, return result
    const finalVideoUrl = noWatermarkUrl || videoUrl;
    if (!finalVideoUrl) return null;
    
    // Build medias
    const videos = [];
    if (noWatermarkUrl) {
      videos.push({ 
        quality: "No Watermark", 
        url: noWatermarkUrl,
        note: "No watermark"
      });
    }
    if (videoUrl && videoUrl !== noWatermarkUrl) {
      videos.push({ 
        quality: "With Watermark", 
        url: videoUrl,
        note: "Contains watermark"
      });
    }
    
    const result = {
      id: Date.now().toString(),
      title: title,
      uploader: author,
      duration_seconds: duration,
      thumbnail: thumbnail,
      music_url: musicUrl,
      webpage_url: url,
      medias: {
        video: videos,
        audio: musicUrl ? [{ quality: "audio", url: musicUrl }] : []
      }
    };
    
    return result;
  } catch (error) {
    return null;
  }
}

// =============================================
// FACEBOOK EXTRACTOR - High/Medium/Low Quality
// =============================================
async function extractFacebook(url) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    const html = await response.text();
    
    const videoUrls = {
      high: [],
      medium: [],
      low: []
    };
    
    // Patterns for different qualities
    const patterns = {
      high: [
        /"playable_url_quality_hd":"([^"]+)"/g,
        /"hd_src":"([^"]+)"/g,
        /"browser_native_hd_url":"([^"]+)"/g
      ],
      medium: [
        /"playable_url_quality_sd":"([^"]+)"/g,
        /"sd_src":"([^"]+)"/g,
        /"browser_native_sd_url":"([^"]+)"/g
      ],
      low: [
        /"playable_url":"([^"]+)"/g,
        /"src":"([^"]*\.mp4[^"]*)"/gi,
        /"browser_native_url":"([^"]+)"/g
      ]
    };
    
    // Extract URLs for each quality
    for (const quality of ['high', 'medium', 'low']) {
      for (const pattern of patterns[quality]) {
        const matches = html.matchAll(pattern);
        for (const match of matches) {
          const urlStr = match[1].replace(/\\/g, "");
          if (urlStr.startsWith("http") && !videoUrls[quality].includes(urlStr)) {
            videoUrls[quality].push(urlStr);
          }
        }
      }
    }
    
    // Deduplicate and clean
    const allUrls = [];
    const qualityMap = {};
    
    // Add high quality first
    for (const url of videoUrls.high) {
      if (!allUrls.includes(url)) {
        allUrls.push(url);
        qualityMap[url] = "High";
      }
    }
    
    // Add medium quality
    for (const url of videoUrls.medium) {
      if (!allUrls.includes(url)) {
        allUrls.push(url);
        qualityMap[url] = "Medium";
      }
    }
    
    // Add low quality
    for (const url of videoUrls.low) {
      if (!allUrls.includes(url)) {
        allUrls.push(url);
        qualityMap[url] = "Low";
      }
    }
    
    // If no videos found, try alternative patterns
    if (allUrls.length === 0) {
      const fallbackPatterns = [
        /"playable_url":"([^"]+)"/g,
        /<video[^>]*src="([^"]*\.mp4[^"]*)"/gi,
        /"src":"([^"]*\.mp4[^"]*)"/gi
      ];
      
      for (const pattern of fallbackPatterns) {
        const matches = html.matchAll(pattern);
        for (const match of matches) {
          const urlStr = match[1].replace(/\\/g, "");
          if (urlStr.startsWith("http") && !allUrls.includes(urlStr)) {
            allUrls.push(urlStr);
            qualityMap[urlStr] = "Standard";
          }
        }
      }
    }
    
    if (allUrls.length === 0) return null;
    
    // Get title
    const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/) ||
                       html.match(/<title>([^<]+)<\/title>/);
    const title = titleMatch ? titleMatch[1].replace(/ \| Facebook$/, "").trim() : "Facebook Video";
    
    // Get thumbnail
    const thumbMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
    const thumbnail = thumbMatch ? thumbMatch[1] : "";
    
    // Build videos array with quality labels
    const videos = allUrls.map((u, i) => ({
      quality: qualityMap[u] || "Standard",
      url: u,
      priority: qualityMap[u] === "High" ? 1 : (qualityMap[u] === "Medium" ? 2 : 3)
    }));
    
    // Sort by quality (High first)
    videos.sort((a, b) => a.priority - b.priority);
    
    return {
      id: Date.now().toString(),
      title: title,
      uploader: "Facebook User",
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
// INSTAGRAM EXTRACTOR - Normal
// =============================================
async function extractInstagram(url) {
  try {
    // Try oEmbed first (free, no API key)
    const oembedUrl = `
