// api/facebook.js - Facebook Downloader (Working)
// Uses free Facebook API

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
      platform: "facebook",
      message: "Facebook Downloader API - HD/SD/Low Quality",
      usage: "/api/facebook?url=FACEBOOK_URL",
      developer: DEVELOPER
    });
  }

  try {
    // Try multiple free Facebook APIs
    const apis = [
      // API 1: VeVioz (Most reliable)
      {
        url: `https://api.vevioz.com/api/facebook?url=${encodeURIComponent(videoUrl)}`,
        parse: (data) => {
          if (data && data.downloads) {
            const videos = [];
            for (const dl of data.downloads) {
              videos.push({
                quality: dl.quality || "SD",
                url: dl.url || dl.link
              });
            }
            return {
              title: data.title || "Facebook Video",
              thumbnail: data.thumbnail || data.cover || "",
              videos: videos,
              author: data.author || "Unknown"
            };
          }
          return null;
        }
      },
      // API 2: Facebook Downloader
      {
        url: `https://fbdownloader.net/api/?url=${encodeURIComponent(videoUrl)}`,
        parse: (data) => {
          if (data && data.success) {
            const videos = [];
            if (data.hd) videos.push({ quality: "HD", url: data.hd });
            if (data.sd) videos.push({ quality: "SD", url: data.sd });
            if (data.normal) videos.push({ quality: "Normal", url: data.normal });
            
            return {
              title: data.title || "Facebook Video",
              thumbnail: data.thumbnail || "",
              videos: videos,
              author: data.author || "Unknown"
            };
          }
          return null;
        }
      },
      // API 3: Facebook Video Downloader
      {
        url: `https://facebook-video-downloader.p.rapidapi.com/api/download?url=${encodeURIComponent(videoUrl)}`,
        parse: (data) => {
          if (data && data.download) {
            const videos = [];
            if (data.download.hd) videos.push({ quality: "HD", url: data.download.hd });
            if (data.download.sd) videos.push({ quality: "SD", url: data.download.sd });
            if (data.download.normal) videos.push({ quality: "Normal", url: data.download.normal });
            
            return {
              title: data.title || "Facebook Video",
              thumbnail: data.thumbnail || "",
              videos: videos,
              author: data.author || "Unknown"
            };
          }
          return null;
        }
      }
    ];
    
    let result = null;
    let usedApi = "";
    
    for (const api of apis) {
      try {
        const response = await fetch(api.url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
          }
        });
        
        if (response.status === 200) {
          const data = await response.json();
          const parsed = api.parse(data);
          if (parsed && parsed.videos && parsed.videos.length > 0) {
            result = parsed;
            usedApi = api.url;
            break;
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    // If all APIs fail, try direct scraping
    if (!result || !result.videos || result.videos.length === 0) {
      const pageResponse = await fetch(videoUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
      });
      const html = await pageResponse.text();
      
      const videoUrls = [];
      
      // Try to find video URLs
      const patterns = [
        /"playable_url_quality_hd":"([^"]+)"/g,
        /"playable_url_quality_sd":"([^"]+)"/g,
        /"playable_url":"([^"]+)"/g,
        /<video[^>]*src="([^"]*\.mp4[^"]*)"/gi,
        /"hd_src":"([^"]+)"/g,
        /"sd_src":"([^"]+)"/g
      ];
      
      const qualityMap = {
        "playable_url_quality_hd": "HD",
        "playable_url_quality_sd": "SD",
        "playable_url": "Normal"
      };
      
      for (const pattern of patterns) {
        const matches = html.matchAll(pattern);
        for (const match of matches) {
          const u = match[1].replace(/\\/g, "");
          if (u.startsWith("http") && !videoUrls.some(v => v.url === u)) {
            let quality = "Standard";
            if (pattern.toString().includes("hd")) quality = "HD";
            else if (pattern.toString().includes("sd")) quality = "SD";
            else if (pattern.toString().includes("playable_url_quality_hd")) quality = "HD";
            else if (pattern.toString().includes("playable_url_quality_sd")) quality = "SD";
            
            videoUrls.push({ quality, url: u });
          }
        }
      }
      
      if (videoUrls.length === 0) {
        return res.status(500).json({
          success: false,
          error: "Could not extract video URL. Try a different Facebook link or check if the video is public.",
          debug: {
            apis_tried: apis.map(a => a.url),
            video_url: videoUrl
          }
        });
      }
      
      // Sort by quality (HD > SD > Normal)
      const qualityOrder = { "HD": 0, "SD": 1, "Normal": 2, "Standard": 3 };
      videoUrls.sort((a, b) => (qualityOrder[a.quality] || 99) - (qualityOrder[b.quality] || 99));
      
      const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/) ||
                         html.match(/<title>([^<]+)<\/title>/);
      const thumbMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
      
      return res.status(200).json({
        success: true,
        platform: "facebook",
        developer: DEVELOPER,
        note: "Extracted via scraping",
        result: {
          title: titleMatch ? titleMatch[1].replace(/ \| Facebook$/, "").trim() : "Facebook Video",
          thumbnail: thumbMatch ? thumbMatch[1] : "",
          medias: {
            hd: videoUrls.filter(v => v.quality === "HD"),
            sd: videoUrls.filter(v => v.quality === "SD"),
            normal: videoUrls.filter(v => v.quality === "Normal" || v.quality === "Standard"),
            all: videoUrls,
            best: videoUrls.length > 0 ? videoUrls[0] : null
          },
          webpage_url: videoUrl
        }
      });
    }
    
    // Separate videos by quality
    const hd = result.videos.filter(v => v.quality === "HD" || v.quality === "1080p");
    const sd = result.videos.filter(v => v.quality === "SD" || v.quality === "720p");
    const normal = result.videos.filter(v => v.quality === "Normal" || v.quality === "480p" || v.quality === "360p");
    
    return res.status(200).json({
      success: true,
      platform: "facebook",
      developer: DEVELOPER,
      api_used: usedApi || "scraping",
      result: {
        title: result.title || "Facebook Video",
        uploader: result.author || "Unknown",
        thumbnail: result.thumbnail || "",
        medias: {
          hd: hd,
          sd: sd,
          normal: normal,
          all: result.videos,
          best: result.videos.length > 0 ? result.videos[0] : null
        },
        webpage_url: videoUrl
      }
    });
    
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
      debug: {
        message: error.message,
        stack: error.stack
      }
    });
  }
}
