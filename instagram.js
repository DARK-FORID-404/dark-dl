// api/instagram.js - Instagram Only
// Video and image support

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
      platform: "instagram",
      message: "Instagram Downloader API",
      usage: "/api/instagram?url=INSTAGRAM_URL",
      developer: DEVELOPER
    });
  }

  try {
    // Try oEmbed first
    const oembedUrl = `https://api.instagram.com/oembed?url=${encodeURIComponent(videoUrl)}`;
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
    
    // Get page HTML
    const response = await fetch(videoUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });
    const html = await response.text();
    
    let videoUrlFound = "";
    let imageUrl = "";
    
    // Try to find video
    const videoPatterns = [
      /<meta property="og:video" content="([^"]+)"/,
      /<meta property="og:video:url" content="([^"]+)"/,
      /"video_url":"([^"]+)"/,
      /"video_versions":\[\{"url":"([^"]+)"/
    ];
    
    for (const pattern of videoPatterns) {
      const match = html.match(pattern);
      if (match) {
        videoUrlFound = match[1].replace(/\\/g, "");
        break;
      }
    }
    
    // If no video, try image
    if (!videoUrlFound) {
      const imgPatterns = [
        /<meta property="og:image" content="([^"]+)"/,
        /"display_url":"([^"]+)"/,
        /"image_versions":\[\{"url":"([^"]+)"/
      ];
      
      for (const pattern of imgPatterns) {
        const match = html.match(pattern);
        if (match) {
          imageUrl = match[1].replace(/\\/g, "");
          break;
        }
      }
    }
    
    // Get author
    const authorMatch = html.match(/@([a-zA-Z0-9_\.]+)/);
    if (authorMatch) {
      author = authorMatch[1];
    }
    
    // Get title if not set
    const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
    if (titleMatch) {
      title = titleMatch[1];
    }
    
    // Build response
    const medias = [];
    if (videoUrlFound) {
      medias.push({ type: "video", url: videoUrlFound });
    }
    if (imageUrl) {
      medias.push({ type: "image", url: imageUrl });
    } else if (thumbnail) {
      medias.push({ type: "image", url: thumbnail });
    }
    
    if (medias.length === 0) {
      return res.status(500).json({
        success: false,
        error: "Could not extract media from Instagram post"
      });
    }
    
    // Separate video and images
    const videos = medias.filter(m => m.type === "video");
    const images = medias.filter(m => m.type === "image");
    
    return res.status(200).json({
      success: true,
      platform: "instagram",
      developer: DEVELOPER,
      result: {
        title: title,
        uploader: author,
        thumbnail: thumbnail,
        medias: {
          video: videos,
          image: images,
          all: medias
        },
        webpage_url: videoUrl,
        is_carousel: images.length > 1 || (images.length > 0 && videos.length > 0)
      }
    });
    
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error"
    });
  }
}
