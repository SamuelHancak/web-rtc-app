import React, { Component } from "react";

import io from "socket.io-client";

import Video from "./components/video";
import Videos from "./components/videos";

const RTCPeerConnectionConfig = {
  iceServers: [
    // {
    //   urls: "turn:numb.viagenie.ca",
    //   credential: "@DGSTSj5mJukHRC",
    //   username: "sam2323@azet.sk",
    // },
    {
      urls: "stun:stun.l.google.com:19302",
    },
  ],
};

const sdpConstraints = {
  mandatory: {
    OfferToReceiveAudio: true,
    OfferToReceiveVideo: true,
  },
};

let peerConnections = {};

class App extends Component {
  constructor(props) {
    super(props);

    this.state = {
      localStream: null, // used to hold local stream object to avoid recreating the stream everytime a new offer comes

      //mute: false,

      remoteStreams: [], // holds all Video Streams (all remote streams)
      selectedVideo: null,

      status: "Please wait...",

      isAdmin: window.location.pathname === "/admin",
    };
  }

  getLocalStream = () => {
    const { isAdmin } = this.state;
    // called when getUserMedia() successfully returns - see below
    // getUserMedia() returns a MediaStream object (https://developer.mozilla.org/en-US/docs/Web/API/MediaStream)
    const success = (stream) => {
      this.setState({
        localStream: stream,
      });

      // var audioTracks = stream.getAudioTracks();
      // for (var i = 0; i < audioTracks.length; ++i) {
      //   audioTracks[i].enabled = this.state.mute;
      // }

      // if (isAdmin) {
      //   audioTracks[0].enabled = true;
      // }
    };

    // called when getUserMedia() fails - see below
    const failure = (e) => {
      console.log("getUserMedia Error: ", e);
    };

    // https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
    // see the above link for more constraint options
    const constraints = {
      audio: true,
      //video: true,
      video: isAdmin
        ? {
            width: {
              max: 1280,
            },
            height: {
              max: 720,
            },
            frameRate: {
              max: 30,
            },
          }
        : {
            width: {
              max: 426,
            },
            height: {
              max: 240,
            },
            frameRate: {
              max: 15,
            },
          },
    };

    // https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
    return navigator.mediaDevices
      .getUserMedia(constraints)
      .then(success)
      .catch(failure);
  };

  componentDidMount = () => {
    const { isAdmin } = this.state;

    this.getLocalStream().then(() => {
      // TODO: add to END
      // socket = io.connect("https://20bb5aa6.ngrok.io/webrtcPeer", {
      // const socket = io.connect("http://localhost:8080", {
      const socket = io.connect("https://coronastage-stream.herokuapp.com", {
        query: {
          admin: isAdmin,
        },
      });

      const sendToPeer = (messageType, payload = null) => {
        socket.emit(messageType, {
          socketId: socket.id,
          payload,
        });
      };

      const createOffer = (pc) => {
        return pc
          .createOffer(sdpConstraints)
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => {
            sendToPeer("offer", {
              desc: pc.localDescription,
            });
          });
      };

      const createPeerConnection = (remoteSocketId, callback) => {
        try {
          let pc = new RTCPeerConnection(RTCPeerConnectionConfig);

          // add pc to peerConnections object
          peerConnections = {
            ...peerConnections,
            [remoteSocketId]: pc,
          };

          pc.onicecandidate = ({ candidate }) => {
            console.log("onicecandidate", { candidate });

            if (candidate) {
              sendToPeer("candidate", { candidate });
            }
          };

          pc.onnegotiationneeded = () => {
            console.log("onnegotiationneeded");

            // createOffer(pc);
          };

          pc.oniceconnectionstatechange = (event) => {
            console.log("oniceconnectionstatechange", { event });

            console.log(pc);
          };

          pc.ontrack = (event) => {
            console.log("ontrack", { event });

            const track = event.track;

            if (track) {
              this.setState(({ selectedVideo, remoteStreams }) => {
                let remoteStreamsCopy = [...remoteStreams];

                // find existing stream to append audio to it or create new stream
                let streamObjIndex = remoteStreamsCopy.findIndex(
                  (stream) => stream.id === remoteSocketId
                );

                // create new stream if not in list
                if (streamObjIndex === -1) {
                  streamObjIndex =
                    remoteStreamsCopy.push({
                      id: remoteSocketId,
                      name: remoteSocketId,
                      stream: new MediaStream(),
                    }) - 1;
                }

                // add track to stream
                remoteStreamsCopy[streamObjIndex].stream.addTrack(track);

                return {
                  selectedVideo:
                    selectedVideo || remoteStreamsCopy[streamObjIndex],
                  remoteStreams: remoteStreamsCopy,
                };
              });
            }
          };

          pc.close = () => {
            // alert('GONE')
          };

          // return pc
          callback(pc);
        } catch (e) {
          console.log("Something went wrong! pc not created!!", e);
          // return;
          callback(null);
        }
      };

      socket.on("candidate", ({ socketId, candidate }) => {
        // get remote's peerConnection
        const pc = peerConnections[socketId];

        if (pc) {
          pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
      });

      socket.on("connectionSuccess", ({ peerCount }) => {
        const status = isAdmin
          ? peerCount > 0
            ? `Total Connected Peers: ${peerCount}`
            : "Waiting for other peers to connect"
          : "Connected";

        this.setState({
          status,
        });
      });

      if (isAdmin) {
        socket.on("peerJoin", ({ socketId, peerCount }) => {
          console.log("peerJoin", { socketId, peerCount });

          this.setState({
            status:
              peerCount > 0
                ? `Total Connected Peers: ${peerCount}`
                : "Waiting for other peers to connect",
          });

          createPeerConnection(socketId, (pc) => {
            // send video and audio to peer
            if (this.state.localStream) {
              this.state.localStream
                .getTracks()
                .forEach((track) => pc.addTrack(track));
            }

            createOffer(pc);
          });
        });

        socket.on("answer", ({ socketId, desc }) => {
          console.log("answer", { socketId, desc });

          // get remote's peerConnection
          const pc = peerConnections[socketId];

          if (pc) {
            pc.setRemoteDescription(new RTCSessionDescription(desc));
          }
        });

        socket.on("peerDisconnect", ({ socketId }) => {
          console.log("peerDisconnect", { socketId });

          this.setState(({ remoteStreams, selectedVideo }) => {
            const newStreams = remoteStreams.filter(
              (stream) => stream.id !== socketId
            );

            return {
              remoteStreams: newStreams,
              // check if disconnected peer is the selected video and if there still connected peers, then select the first
              selectedVideo:
                selectedVideo && selectedVideo.id === socketId
                  ? remoteStreams[0]
                  : selectedVideo,
            };
          });
        });
      } else {
        socket.on("offer", ({ socketId, desc }) => {
          console.log("offer", { socketId, desc });

          createPeerConnection(socketId, (pc) => {
            // send video and audio to peer
            if (this.state.localStream) {
              this.state.localStream
                .getTracks()
                .forEach((track) => pc.addTrack(track));
            }

            pc.setRemoteDescription(new RTCSessionDescription(desc))
              .then(() => pc.createAnswer(sdpConstraints))
              .then((answer) => pc.setLocalDescription(answer))
              .then(() => {
                sendToPeer("answer", {
                  desc: pc.localDescription,
                });
              });
          });
        });
      }
    });
  };

  switchVideo = (_video) => {
    this.setState({
      selectedVideo: _video,
    });
  };

  render() {
    //console.log(this.state.localStream);

    const statusText = (
      <div style={{ color: "yellow", padding: 5 }}>{this.state.status}</div>
    );

    return (
      <div style={{ backgroundColor: "black", minHeight: "100%" }}>
        {this.state.isAdmin ? (
          <>
            <div>
              <Videos
                //switchVideo={this.switchVideo}
                remoteStreams={this.state.remoteStreams}
              ></Videos>
            </div>
            <Video
              videoStyles={{
                zIndex: 2,
                position: "absolute",
                right: 10,
                bottom: 10,
                width: 200,
                height: 200,
                margin: 5,
                backgroundColor: "black",
              }}
              // ref={this.localVideoref}
              videoStream={this.state.localStream}
              autoPlay
              muted
            ></Video>
            <div
              style={{
                zIndex: 4,
                position: "absolute",
                margin: 10,
                backgroundColor: "#cdc4ff4f",
                padding: 10,
                borderRadius: 5,
                right: 10,
                bottom: 200,
              }}
            >
              {statusText}
            </div>
          </>
        ) : (
          <>
            <Video
              videoStyles={{
                zIndex: 2,
                position: "absolute",
                right: 0,
                width: 200,
                height: 200,
                margin: 5,
                backgroundColor: "black",
              }}
              // ref={this.localVideoref}
              videoStream={this.state.localStream}
              autoPlay
              muted
            ></Video>

            {this.state.selectedVideo ? (
              <Video
                videoStyles={{
                  zIndex: 1,
                  position: "fixed",
                  bottom: 0,
                  minWidth: "100%",
                  minHeight: "100%",
                  backgroundColor: "black",
                }}
                // ref={ this.remoteVideoref }
                videoStream={this.state.selectedVideo.stream}
                autoPlay
                //muted={this.state.muted}
              ></Video>
            ) : null}

            <div
              style={{
                zIndex: 4,
                position: "absolute",
                margin: 10,
                backgroundColor: "#cdc4ff4f",
                padding: 10,
                borderRadius: 5,
              }}
            >
              {statusText}
            </div>

            <div
              style={{
                zIndex: 5,
                position: "absolute",
                margin: 10,
                right: 10,
                bottom: 120,
              }}
            >
              {/* <button
                onMouseDown={() => {
                  for (
                    var i = 0;
                    i < this.state.localStream.getAudioTracks().length;
                    ++i
                  ) {
                    this.state.localStream.getAudioTracks()[i].enabled = true;
                  }
                }}
                onMouseUp={() => {
                  for (
                    var i = 0;
                    i < this.state.localStream.getAudioTracks().length;
                    ++i
                  ) {
                    this.state.localStream.getAudioTracks()[i].enabled = false;
                  }
                }}
              >
                Push to talk
              </button> */}
            </div>
          </>
        )}
      </div>
    );
  }
}

export default App;
