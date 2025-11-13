const express = require("express");
const puppeteer = require("puppeteer");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Health check endpoint
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "Twitter Quote Generator API",
    endpoints: {
      health: "GET /",
      generate: "POST /api/generate-tweet"
    },
    version: "1.0.0"
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

    // Launch browser
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
        "--window-size=1500x1500"
      ]
    });

    const page = await browser.newPage();
    
    // Set viewport
    await page.setViewport({ 
      width: 1500, 
      height: 1500,
      deviceScaleFactor: 2
    });

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
              white-space: pre-line;
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
                    src="${profileImage || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E%3Crect width='48' height='48' fill='%231f2937'/%3E%3C/svg%3E"}" 
                    class="profile-img" 
                    alt="Profile"
                  />
                </div>
                <div class="profile-info">
                  <div class="name">${name}</div>
                  <div class="handle">@${handle}</div>
                </div>
                <div class="menu-dots">•••</div>
              </div>
              <div class="tweet-text">${tweet.replace(/\n/g, "<br>").replace(/'/g, "&#39;").replace(/"/g, "&quot;")}</div>
            </div>
          </div>
        </body>
      </html>
    `;

    // Load HTML
    await page.setContent(html, { 
      waitUntil: "networkidle0",
      timeout: 30000
    });

    // Take screenshot
    const screenshot = await page.screenshot({ 
      type: "png",
      omitBackground: false
    });

    console.log(`[${new Date().toISOString()}] Quote generated successfully`);

    // Send image
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Disposition", 'attachment; filename="twitter-quote.png"');
    res.send(screenshot);

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error:`, error);
    res.status(500).json({
      error: "Failed to generate quote image",
      message: error.message
    });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Not found",
    path: req.path
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ API running on http://localhost:${PORT}`);
  console.log(`📝 Health check: http://localhost:${PORT}/`);
  console.log(`🚀 Generate endpoint: http://localhost:${PORT}/api/generate-tweet`);
});
