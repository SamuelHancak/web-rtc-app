const express = require("express");
const http = require("http");
const socket = require("./socket");

const app = express();
const server = http.createServer(app);

// must be before app.get("/", ...)
socket.listen(server);

// TODO: remove react in future and use socket as standalone server
app.use(express.static(__dirname + "/build"));
app.get("/", (req, res, next) => {
  res.sendFile(__dirname + "/build/index.html");
});
app.get("/admin", (req, res, next) => {
  res.sendFile(__dirname + "/build/index.html");
});

const port = process.env.PORT || 3000;

server.listen(port, () =>
  console.log(`Example app listening on port ${port}!`)
);
