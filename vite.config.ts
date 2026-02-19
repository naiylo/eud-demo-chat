import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL(".", import.meta.url));
const widgetsDir = path.join(rootDir, "src", "widgets");
const registryPath = path.join(widgetsDir, "registry.ts");

function sanitizeSlug(input: string) {
  const cleaned = input.replace(/[^a-zA-Z0-9-_]/g, "");
  return cleaned || `widget-${Date.now()}`;
}

async function readRequestBody(req: any) {
  return new Promise<string>((resolve, reject) => {
    let data = "";
    req.on("data", (chunk: Buffer) => {
      data += chunk.toString();
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

async function ensureRegistry(exportName: string, slug: string) {
  const content = await fs.promises.readFile(registryPath, "utf8");
  const lines = content.split("\n");
  const importLine = `import { ${exportName} } from "./${slug}";`;
  const hasImport = lines.some((l) => l.includes(importLine));
  let next = lines;

  if (!hasImport) {
    const lastImportIdx = lines.reduce(
      (idx, line, i) => (line.startsWith("import") ? i : idx),
      -1
    );
    next = [
      ...lines.slice(0, lastImportIdx + 1),
      importLine,
      ...lines.slice(lastImportIdx + 1),
    ];
  }

  const joined = next.join("\n");
  const match = joined.match(
    /export const widgetRegistry: AnyWidgetDefinition\[] = \[([\s\S]*?)\];/
  );

  if (!match) {
    throw new Error("Could not find widgetRegistry array");
  }

  const body = match[1];
  const entries = body
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const hasEntry = entries.some(
    (line) => line.replace(/[,/]/g, "").trim() === exportName
  );

  if (!hasEntry) {
    entries.push(`${exportName},`);
  }

  const bodyString = entries
    .map((line) =>
      line.startsWith("//") || line.endsWith(",") ? `  ${line}` : `  ${line},`
    )
    .join("\n");

  const updated = joined.replace(
    /export const widgetRegistry: AnyWidgetDefinition\[] = \[[\s\S]*?\];/,
    `export const widgetRegistry: AnyWidgetDefinition[] = [\n${bodyString}\n];`
  );

  await fs.promises.writeFile(registryPath, updated, "utf8");
}

async function removeFromRegistry(exportName: string) {
  const content = await fs.promises.readFile(registryPath, "utf8");
  const lines = content.split("\n");
  const filteredImports = lines.filter((line) => {
    if (!line.startsWith("import")) return true;
    const normalized = line.replace(/[\s{}]/g, "");
    // Match exact export name, avoid substring collisions (examplepoll vs examplepoll2).
    return !new RegExp(`\\b${exportName}\\b`).test(normalized);
  });
  const joined = filteredImports.join("\n");

  const match = joined.match(
    /export const widgetRegistry: AnyWidgetDefinition\[] = \[([\s\S]*?)\];/
  );
  if (!match) return;

  const entries = match[1]
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((line) => {
      const token = line.replace(/[,/]/g, "").trim();
      return token !== exportName;
    });

  const bodyString = entries
    .map((line) =>
      line.startsWith("//") || line.endsWith(",") ? `  ${line}` : `  ${line},`
    )
    .join("\n");

  const updated = joined.replace(
    /export const widgetRegistry: AnyWidgetDefinition\[] = \[[\s\S]*?\];/,
    `export const widgetRegistry: AnyWidgetDefinition[] = [\n${bodyString}\n];`
  );

  await fs.promises.writeFile(registryPath, updated, "utf8");
}

const widgetWriter = {
  name: "widget-writer",
  apply: "serve" as const,
  configureServer(server: any) {
    server.middlewares.use(
      "/api/widgets",
      async (req: any, res: any, next: any) => {
        if (req.method === "POST") {
          try {
            const raw = await readRequestBody(req);
            const data = JSON.parse(raw || "{}") as { code?: string };
            if (!data.code || typeof data.code !== "string") {
              res.statusCode = 400;
              res.end("Missing code");
              return;
            }

            const exportMatch = data.code.match(/export const\s+(\w+)/);
            const exportName = exportMatch?.[1] ?? "customWidget";
            const slug = sanitizeSlug(exportName);
            const targetPath = path.join(widgetsDir, `${slug}.tsx`);

            await fs.promises.mkdir(widgetsDir, { recursive: true });
            await fs.promises.writeFile(targetPath, data.code, "utf8");
            await ensureRegistry(exportName, slug);

            res.setHeader("Content-Type", "application/json");
            res.statusCode = 200;
            res.end(JSON.stringify({ ok: true, slug, exportName }));
          } catch (err: any) {
            console.error(err);
            res.statusCode = 500;
            res.end("Failed to save widget");
          }
          return;
        }

        if (req.method === "DELETE") {
          try {
            const url = new URL(req.url, "http://localhost");
            const name = url.searchParams.get("name");
            if (!name) {
              res.statusCode = 400;
              res.end("Missing name");
              return;
            }
            const slug = sanitizeSlug(name);
            const targetPath = path.join(widgetsDir, `${slug}.tsx`);
            await removeFromRegistry(name);
            await fs.promises.rm(targetPath, { force: true });
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true, removed: true, slug }));
          } catch (err: any) {
            console.error(err);
            res.statusCode = 500;
            res.end("Failed to delete widget");
          }
          return;
        }

        return next();
      }
    );
  },
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), widgetWriter],
  server: {
        host: true,
        port: 8080
      },
  base: "/eud-demo-chat/",
});
