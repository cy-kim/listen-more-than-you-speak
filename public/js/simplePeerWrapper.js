import { resizeVideos } from "./resizeVideos.js";
// A wrapper for simplepeer as we need a bit more than it provides
export default class SimplePeerWrapper {
  constructor(initiator, socket_id, socket, stream) {
    this.simplepeer = new SimplePeer({
      initiator: initiator,
      trickle: false,
    });

    // Their socket id, our unique id for them
    this.socket_id = socket_id;

    // Socket.io Socket
    this.socket = socket;

    // Our video stream - need getters and setters for this --local stream
    this.stream = stream;

    // Initialize mediaStream to null
    this.peerStream = null;

    this.peerVideo = null;

    this.myElapsedTime = 0;

    this.hasConnected = false;

    // simplepeer generates signals which need to be sent across socket
    this.simplepeer.on("signal", (data) => {
      this.socket.emit("signal", this.socket_id, this.socket.id, data);
    });

    // When we have a connection, send our stream
    this.simplepeer.on("connect", () => {
      console.log("CONNECT");
      this.hasConnected = true;

      // Let's give them our stream
      this.simplepeer.addStream(stream).catch(console.log("NOT STREAMING"));

      console.log("Send our stream");
    });

    // Stream coming in to us
    this.simplepeer.on("stream", (stream) => {
      this.peerStream = stream;
      let peerVideo = document.createElement("video");
      peerVideo.id = this.socket_id;
      peerVideo.height = 300;
      peerVideo.width = 300;
      peerVideo.classList.add("peervideo");
      document.body.appendChild(peerVideo);
      peerVideo.srcObject = stream;
      // Wait for the stream to load enough to play
      peerVideo.onloadedmetadata = function (e) {
        peerVideo.play();
      };
      this.peerVideo = peerVideo;
    });

    this.simplepeer.on("data", (data) => {
      const { myElapsedTime } = JSON.parse(data);
      this.myElapsedTime += myElapsedTime;
      console.log("received data: ", myElapsedTime);
      resizeVideos(0);
    });
  }

  destroy() {
    document.body.removeChild(this.peerVideo);
  }

  inputsignal(sig) {
    this.simplepeer.signal(sig);
  }
}
