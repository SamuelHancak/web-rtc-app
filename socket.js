const socket = require("socket.io");

var io = socket();

// keep a reference of all socket connections
let connectedPeers = new Map();
let connectedPeersAdmin = new Map();

const emitToAdmins = (type, data) => {
  for (const [socketId, socket] of connectedPeersAdmin.entries()) {
    socket.emit(type, data);
  }
};

const emitToUsers = (type, data) => {
  for (const [socketId, socket] of connectedPeers.entries()) {
    socket.emit(type, data);
  }
};

io.on("connection", (socket) => {
  const isAdmin = socket.handshake.query.admin === "true";

  if (isAdmin) {
    connectedPeersAdmin.set(socket.id, socket);
  } else {
    connectedPeers.set(socket.id, socket);
  }

  // send response back
  socket.emit(
    "connectionSuccess",
    isAdmin
      ? {
          success: socket.id,
          peerCount: connectedPeers.size,
        }
      : { success: socket.id }
  );

  // notify admin about new connected peer
  if (!isAdmin) {
    emitToAdmins("peerJoin", {
      socketId: socket.id,
      peerCount: connectedPeers.size,
    });
  }

  socket.on("disconnect", () => {
    if (isAdmin) {
      connectedPeersAdmin.delete(socket.id);
      // TODO: kill socket if no admin left
    } else {
      connectedPeers.delete(socket.id);
    }

    // nofify admin about diconection
    emitToAdmins("peerDisconnect", {
      socketId: socket.id,
      peerCount: connectedPeers.size,
    });
  });

  if (isAdmin) {
    socket.on("offer", ({ socketId, payload }) => {
      emitToUsers("offer", {
        socketId,
        ...payload,
      });
    });

    socket.on("candidate", ({ socketId, payload }) => {
      emitToUsers("candidate", {
        socketId,
        ...payload,
      });
    });
  } else {
    socket.on("answer", ({ socketId, payload }) => {
      emitToAdmins("answer", {
        socketId,
        ...payload,
      });
    });

    socket.on("candidate", ({ socketId, payload }) => {
      emitToAdmins("candidate", {
        socketId,
        ...payload,
      });
    });
  }
});

module.exports = io;
