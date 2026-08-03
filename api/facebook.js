// api/facebook.js - Facebook Only
// HD, SD, Low quality

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
      message: "Facebook Downloader API",
      usage: "/api/facebook?url=FACEBOOK_URL",
      quality_options: ["HD", "SD", "Low"],
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
    
    const videoUrls = {
      hd: [],
      sd: [],
      low: []
    };
    
    // HD quality
    const hdMatches = html.matchAll(/"playable_url_quality_hd":"([^"]+)"/g);
    for (const match of hdMatches) {
      const u = match[1].replace(/\\/g, "");
      if (u.startsWith("http") && !videoUrls.hd.includes(u)) {
        videoUrls.hd.push(u);
      }
    }
    
    // SD quality
    const sdMatches = html.matchAll(/"playable_url_quality_sd":"([^"]+)"/g);
    for (const match of sdMatches) {
      const u = match[1].replace(/\\/g, "");
      if (u.startsWith("http") && !videoUrls.sd.includes(u)) {
        videoUrls.sd.push(u);
      }
    }
    
    // Low quality (fallback)
    const lowMatches = html.matchAll(/"playable_url":"([^"]+)"/g);
    for (const match of lowMatches) {
      const u = match[1].replace(/\\/g, "");
      if (u.startsWith("http") && !videoUrls.low.includes(u)) {
        videoUrls.low.push(u);
      }
    }
    
    // If no videos found, try other patterns
    if (videoUrls.hd.length === 0 && videoUrls.sd.length === 0 && videoUrls.low.length === 0) {
      const allMatches = html.matchAll(/<video[^>]*src="([^"]*\.mp4[^"]*)"/gi);
      let i = 0;
      for (const match of allMatches) {
        const u = match[1].replace(/\\/g, "");
        if (u.startsWith("http")) {
          if (i === 0) videoUrls.hd.push(u);
          else if (i === 1) videoUrls.sd.push(u);
          else videoUrls.low.push(u);
          i++;
        }
      }
    }
    
    // Get title
    const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/) ||
                       html.match(/<title>([^<]+)<\/title>/);
    const title = titleMatch ? titleMatch[1].replace(/ \| Facebook$/, "").trim() : "Facebook Video";
    
    // Get thumbnail
    const thumbMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
    const thumbnail = thumbMatch ? thumbMatch[1] : "";
    
    // Build response
    const medias = [];
    
    // Add HD videos
    for (const u of videoUrls.hd) {
      medias.push({ quality: "HD", url: u });
    }
    
    // Add SD videos
    for (const u of videoUrls.sd) {
      medias.push({ quality: "SD", url: u });
    }
    
    // Add Low videos
    for (const u of videoUrls.low) {
      medias.push({ quality: "Low", url: u });
    }
    
    if (medias.length === 0) {
      return res.status(500).json({
        success: false,
        error: "Could not extract video URL"
      });
    }
    
    // Separate by quality
    const hdVideos = medias.filter(m => m.quality === "HD");
    const sdVideos = medias.filter(m => m.quality === "SD");
    const lowVideos = medias.filter(m => m.quality === "Low");
    
    return res.status(200).json({
      success: true,
      platform: "facebook",
      developer: DEVELOPER,
      result: {
        title: title,
        thumbnail: thumbnail,
        medias: {
          hd: hdVideos,
          sd: sdVideos,
          low: lowVideos,
          all: medias,
          best: medias.length > 0 ? medias[0] : null
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
