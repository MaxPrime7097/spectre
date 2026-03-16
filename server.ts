import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import * as fs from "fs/promises";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route: Apply Fix
  app.post("/api/apply-fix", async (req, res, next) => {
    try {
      const { file_path, patch } = req.body;

      if (!file_path || !patch) {
        return res.status(400).json({ error: "Missing file_path or patch" });
      }

      const absolutePath = path.resolve(process.cwd(), file_path);
      const rootPath = process.cwd();
      
      console.log(`[SPECTRE] Attempting to apply patch to: ${absolutePath}`);
      console.log(`[SPECTRE] Root path: ${rootPath}`);

      // Security check: ensure path is within project
      if (!absolutePath.startsWith(rootPath)) {
        console.error(`[SPECTRE] Access denied: ${absolutePath} is outside of ${rootPath}`);
        return res.status(403).json({ error: "Access denied: Path is outside of project root" });
      }

      try {
        await fs.access(absolutePath);
      } catch (e) {
        console.error(`[SPECTRE] File not found: ${absolutePath}`);
        return res.status(404).json({ error: `File not found: ${file_path}` });
      }

      let content = await fs.readFile(absolutePath, "utf-8");
      
      // Improved patch application logic
      const lines = patch.split("\n");
      const removedLines = lines
        .filter((l: string) => l.startsWith("-"))
        .map((l: string) => l.substring(1));
      const addedLines = lines
        .filter((l: string) => l.startsWith("+"))
        .map((l: string) => l.substring(1));

      if (removedLines.length > 0) {
        const targetBlock = removedLines.join("\n");
        const replacementBlock = addedLines.join("\n");
        
        if (content.includes(targetBlock)) {
          content = content.replace(targetBlock, replacementBlock);
        } else {
          // Fallback: try with trimmed lines if exact match fails
          const trimmedTarget = removedLines.map(l => l.trim()).join("\n");
          const contentLines = content.split("\n");
          
          let foundIndex = -1;
          for (let i = 0; i <= contentLines.length - removedLines.length; i++) {
            let match = true;
            for (let j = 0; j < removedLines.length; j++) {
              if (contentLines[i + j].trim() !== removedLines[j].trim()) {
                match = false;
                break;
              }
            }
            if (match) {
              foundIndex = i;
              break;
            }
          }

          if (foundIndex !== -1) {
            contentLines.splice(foundIndex, removedLines.length, ...addedLines);
            content = contentLines.join("\n");
          } else {
            console.error(`[SPECTRE] Could not find code block in ${file_path}`);
            return res.status(404).json({ error: "Could not find code block to patch. The file might have changed since analysis." });
          }
        }
      } else if (addedLines.length > 0) {
        content += "\n" + addedLines.join("\n");
      }

      await fs.writeFile(absolutePath, content, "utf-8");
      
      console.log(`[SPECTRE] Patch applied to ${file_path}`);
      res.json({ status: "success", message: `Patch applied to ${file_path}` });
    } catch (error: any) {
      next(error);
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Global Error Handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("[SPECTRE] Server Error:", err);
    res.status(500).json({ 
      error: "Internal Server Error", 
      message: err.message,
      stack: process.env.NODE_ENV !== "production" ? err.stack : undefined
    });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SPECTRE] Server running on http://localhost:${PORT}`);
  });
}

startServer();
