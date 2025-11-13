const express = require("express");
const puppeteer = require("puppeteer");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Health check endpoint
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "Twitter Quote Generator API",
    endpoints: {
      health: "GET /",
      generate: "POST /api/generate-tweet"
    },
    version: "1.0.0",
    timestamp: new Date().toISOString()
  });
});

// Test endpoint (no images)
app.post("/api/test", async (req, res) => {
  const { name, handle, tweet } = req.body;
  
  res.json({
    received: { name, handle, tweet },
    status: "API is working"
  });
});

// Generate tweet image endpoint
app.post("/api/generate-tweet", async (req, res) => {
  let browser = null;
  
  try {
    const { name, handle, tweet, profileImage, background } = req.body;

    // Validate required fields
    if (!name || !handle || !tweet) {
      return res.status(400).json({
        error: "Missing required fields",
        required: ["name", "handle", "tweet"]
      });
    }

    console.log(`[${new Date().toISOString()}] Generating quote for @${handle}`);

    // Launch browser with optimized settings
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--single-process",
        "--disable-gpu"
      ],
      timeout: 30000
    });

    const page = await browser.newPage();
    
    // Set viewport
    await page.setViewport({ 
      width: 1500, 
      height: 1500,
      deviceScaleFactor: 1
    });

    // Escape special characters
    const escapedTweet = tweet
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;")
      .replace(/\n/g, "<br>");

    const escapedName = name
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

    const escapedHandle = handle
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

    // Default profile image (gray circle SVG)
    const defaultProfileImage = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E%3Crect width='48' height='48' fill='%231f2937'/%3E%3C/svg%3E";

    // Generate HTML
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              margin: 0;
              padding: 0;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            }
            
            .tweet-container {
              width: 1500px;
              height: 1500px;
              background-color: #15202B;
              ${background ? `background-image: url('${background}');` : ""}
              background-size: cover;
              background-position: center;
              display: flex;
              align-items: center;
              justify-content: center;
              position: relative;
              overflow: hidden;
            }
            
            .tweet-content-wrapper {
              width: 100%;
              max-width: 512px;
              background: #151f2b;
              padding: 48px;
              border-radius: 8px;
            }
            
            .profile-section {
              display: flex;
              align-items: flex-start;
              margin-bottom: 16px;
            }
            
            .profile-img-wrapper {
              width: 48px;
              height: 48px;
              border-radius: 50%;
              overflow: hidden;
              margin-right: 12px;
              background: #1f2937;
              border: 1px solid #374151;
              flex-shrink: 0;
            }
            
            .profile-img {
              width: 100%;
              height: 100%;
              object-fit: cover;
            }
            
            .profile-info {
              flex-grow: 1;
              min-width: 0;
            }
            
            .name {
              color: white;
              font-weight: bold;
              font-size: 20px;
              line-height: 1.2;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            
            .handle {
              color: #6b7280;
              font-size: 20px;
              line-height: 1;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            
            .menu-dots {
              color: #6b7280;
              font-size: 14px;
              line-height: 1;
              flex-shrink: 0;
              margin-left: 8px;
            }
            
            .tweet-text {
              color: white;
              font-size: 24px;
              line-height: 1.5;
              word-wrap: break-word;
            }
          </style>
        </head>
        <body>
          <div class="tweet-container">
            <div class="tweet-content-wrapper">
              <div class="profile-section">
                <div class="profile-img-wrapper">
                  <img 
                    src="${profileImage || defaultProfileImage}" 
                    class="profile-img" 
                    alt="Profile"
                    onerror="this.src='${defaultProfileImage}'"
                  />
                </div>
                <div class="profile-info">
                  <div class="name">${escapedName}</div>
                  <div class="handle">@${escapedHandle}</div>
                </div>
                <div class="menu-dots">•••</div>
              </div>
              <div class="tweet-text">${escapedTweet}</div>
            </div>
          </div>
        </body>
      </html>
    `;

    // Load HTML and wait for everything
    await page.setContent(html, { 
      waitUntil: ["networkidle0", "domcontentloaded"],
      timeout: 30000
    });

    // Wait a bit extra for images to load
    await page.waitForTimeout(1000);

    // Take screenshot
    const screenshot = await page.screenshot({ 
      type: "png",
      omitBackground: false,
      fullPage: false,
      encoding: "binary" // Important: binary encoding
    });

    console.log(`[${new Date().toISOString()}] Screenshot generated: ${screenshot.length} bytes`);

    // Close browser before sending response
    await browser.close();
    browser = null;

    // Send image with correct headers
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Length", screenshot.length);
    res.setHeader("Cache-Control", "no-cache");
    res.end(screenshot, "binary");

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error:`, error.message);
    console.error(error.stack);
    
    // Make sure to close browser on error
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error("Error closing browser:", closeError);
      }
    }
    
    res.status(500).json({
      error: "Failed to generate quote image",
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Not found",
    path: req.path,
    method: req.method
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ API running on http://localhost:${PORT}`);
  console.log(`📝 Health check: http://localhost:${PORT}/`);
  console.log(`🧪 Test endpoint: http://localhost:${PORT}/api/test`);
  console.log(`🚀 Generate endpoint: http://localhost:${PORT}/api/generate-tweet`);
});
