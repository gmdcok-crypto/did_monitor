const http = require("http");

const port = Number(process.env.PORT) || 3000;

const server = http.createServer((req, res) => {
  if (req.url === "/" || req.url === "/health") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(
      "<!doctype html><html><head><meta charset=utf-8><title>DID Monitor</title></head>" +
        "<body><h1>DID Monitor</h1><p>서비스가 동작 중입니다.</p></body></html>"
    );
    return;
  }
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not Found");
});

server.listen(port, "0.0.0.0", () => {
  console.log(`listening on ${port}`);
});
