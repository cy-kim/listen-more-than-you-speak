import { fileURLToPath } from "url";
import path from "path";

import socket from "socket.io";
// Here is the actual HTTP server
import { createServer } from "http";
// Express is a node module for building HTTP servers
import express from "express";

var app = express();
// Tell Express to look in the "public" folder for any files first
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "/public")));
// app.use(express.static("public"));

// If the user just goes to the "route" / then run this function
app.get("/health", function (req, res) {
  res.send("Hello World!");
});

// We pass in the Express object and the options object
var httpServer = createServer(app);

// Default HTTPS port
httpServer.listen(process.env.PORT || 7000);
/* 
This server simply keeps track of the peers all in one big "room"
and relays signal messages back and forth.
*/

let peers = [];

// WebSocket Portion
// WebSockets work with the HTTP server
var io = socket.listen(httpServer);

/*Redirect if there is no www*/
// app.get('/*', function(req, res, next) {
//   if (req.headers.host.match(/^www/) !== null ) {
//     res.redirect('http://' + req.headers.host.replace(/^www\./, '') + req.url);
//   } else {
//     next();
//   }
// })

// Register a callback function to run when we have an individual connection
// This is run for each individual user that connects
io.sockets.on(
  "connection",

  // We are given a websocket object in our function
  function (socket) {
    peers.push({ socket: socket });
    console.log(
      "We have a new client: " + socket.id + " peers length: " + peers.length
    );

    socket.on("list", function () {
      let ids = [];
      for (let i = 0; i < peers.length; i++) {
        ids.push(peers[i].socket.id);
      }
      console.log("ids length: " + ids.length);
      socket.emit("listresults", ids);
    });

    // Relay signals back and forth
    socket.on("signal", (to, from, data) => {
      console.log("SIGNAL", to, data);
      let found = false;
      for (let i = 0; i < peers.length; i++) {
        console.log(peers[i].socket.id, to);
        if (peers[i].socket.id == to) {
          console.log("Found Peer, sending signal");
          peers[i].socket.emit("signal", to, from, data);
          found = true;
          break;
        }
      }
      if (!found) {
        console.log("never found peer");
      }
    });

    socket.on("disconnect", function () {
      console.log("Client has disconnected " + socket.id);
      io.emit("peer_disconnect", socket.id);
      for (let i = 0; i < peers.length; i++) {
        if (peers[i].socket.id == socket.id) {
          peers.splice(i, 1);
        }
      }
    });
  }
);
