import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
const files = new Map([
  ["/", "index.html"],
  ["/index.html", "index.html"],
  ["/app.js", "app.js"],
  ["/app.css", "app.css"],
  ["/build.json", "build.json"],
  ["/public-vectors.json", "public-vectors.json"],
]);
const type = {
  html: "text/html",
  js: "text/javascript",
  css: "text/css",
  json: "application/json",
};
export async function startServer(port = 4400) {
  await readFile("dist/build.json");
  const server = createServer(async (request, response) => {
    try {
      const file = files.get(request.url);
      if (!file || request.method !== "GET") {
        response.writeHead(404).end();
        return;
      }
      const body = await readFile("dist/" + file);
      response
        .writeHead(200, {
          "content-type": type[file.split(".").at(-1)],
          "cache-control": "no-store",
        })
        .end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close();
      reject(Error("Test server did not start within 15 seconds"));
    }, 15_000);
    server.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    server.listen(port, "127.0.0.1", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
  return server;
}
if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  const server = await startServer();
  console.log(
    "QoreLens test server ready on http://127.0.0.1:" + server.address().port,
  );
}
