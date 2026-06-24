import express from "express";
import path from "path";
import fs from "fs/promises";
import { createWriteStream } from "fs";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Support CORS
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    } else {
      res.setHeader("Access-Control-Allow-Origin", "*");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // Support JSON bodies
  app.use(express.json());

  // Path to wishes file
  const wishesPath = path.join(process.cwd(), "src", "data", "wishes.json");
  // Path to custom background video
  const videoPath = path.join(process.cwd(), "src", "data", "background_video.mp4");

  // Helper to read wishes
  async function readWishes() {
    try {
      const data = await fs.readFile(wishesPath, "utf-8");
      return JSON.parse(data);
    } catch (error) {
      // If file doesn't exist, return a fallback empty list or template
      console.error("Error reading wishes, falling back to empty list:", error);
      return [];
    }
  }

  // Helper to write wishes
  async function writeWishes(wishes: any[]) {
    try {
      // Ensure directory exists
      await fs.mkdir(path.dirname(wishesPath), { recursive: true });
      await fs.writeFile(wishesPath, JSON.stringify(wishes, null, 2), "utf-8");
    } catch (error) {
      console.error("Error writing wishes:", error);
    }
  }

  // API endpoints
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Get all wishes
  app.get("/api/wishes", async (req, res) => {
    try {
      const wishes = await readWishes();
      res.json(wishes);
    } catch (error) {
      res.status(500).json({ error: "Failed to read wishes" });
    }
  });

  // Add a new wish
  app.post("/api/wishes", async (req, res) => {
    try {
      const { name, message, color } = req.body;
      if (!name || !message) {
        return res.status(400).json({ error: "Name and message are required" });
      }

      const wishes = await readWishes();
      const newWish = {
        id: Date.now().toString(),
        name: name.substring(0, 50),
        message: message.substring(0, 300),
        timestamp: new Date().toISOString(),
        color: color || "gold"
      };

      wishes.push(newWish);
      await writeWishes(wishes);

      res.status(201).json(newWish);
    } catch (error) {
      res.status(500).json({ error: "Failed to save wish" });
    }
  });

  // Delete a specific wish
  app.delete("/api/wishes/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const wishes = await readWishes();
      const filteredWishes = wishes.filter((w: any) => w.id !== id);
      
      if (wishes.length === filteredWishes.length) {
        return res.status(404).json({ error: "Wish not found" });
      }

      await writeWishes(filteredWishes);
      res.json({ success: true, message: "Wish deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete wish" });
    }
  });

  // Get current status of background video
  app.get("/api/video-status", async (req, res) => {
    try {
      await fs.access(videoPath);
      res.json({ hasCustomVideo: true });
    } catch {
      res.json({ hasCustomVideo: false });
    }
  });

  // Serve background video (streams file if uploaded, redirects to luxurious particles default if not)
  app.get("/api/background-video.mp4", async (req, res) => {
    try {
      await fs.access(videoPath);
      res.sendFile(videoPath);
    } catch {
      // Fallback: Elegant gold dust particles
      res.redirect("https://assets.mixkit.co/videos/preview/mixkit-mysterious-sparkling-dust-particles-40018-large.mp4");
    }
  });

  // Upload or update custom background video
  app.post("/api/upload-video", async (req, res) => {
    try {
      await fs.mkdir(path.dirname(videoPath), { recursive: true });
      const writeStream = createWriteStream(videoPath);
      
      req.pipe(writeStream);

      req.on("end", () => {
        res.json({ success: true, url: "/api/background-video.mp4" });
      });

      req.on("error", (err) => {
        console.error("Error writing video file upload stream:", err);
        res.status(500).json({ error: "Video file upload failed" });
      });
    } catch (error) {
      console.error("Video upload handler error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Delete custom background video and revert to premium gold particles loop
  app.delete("/api/upload-video", async (req, res) => {
    try {
      await fs.unlink(videoPath);
      res.json({ success: true });
    } catch (error) {
      res.json({ success: true }); // Ignore error if file was already deleted
    }
  });

  // Integrate Vite dev server or serve production build
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // SPA Fallback
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Wedding App Server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start wedding app server:", err);
});
