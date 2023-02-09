//128 is threshold for minimum volume
//TODO: set average threshold before you enter the chat
let myStream = null;
//audio stuff
let mySpokenFor = 0;

let simplepeers = [
  { id: 0, myElapsedTime: 1000 },
  { id: 1, myElapsedTime: 2000 },
  { id: 2, myElapsedTime: 300 },
];
let socket;
let threshold = 127.8;
let myElapsedTime = 0;

// wait for window to load
window.addEventListener("load", function () {
  // Constraints - what do we want?
  let constraints = {
    audio: true,
    video: true,
  };
  // navigator - interface that represents the state and the identity of the user agent. allows scripts to query it and register themselves to do some activities
  navigator.mediaDevices
    .getUserMedia(constraints)
    .then(function (stream) {
      myStream = stream;
      // separate audio and video so we can add audio to canvas prior to streaming to peers
      const video = document.getElementById("myvideo");
      video.srcObject = stream;

      // Wait for the stream to load enough to play
      video.onloadedmetadata = function (e) {
        video.play();
      };
      const audioStream = new MediaStream(stream.getAudioTracks());
      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();

      // Creating audio meter
      const mediaStreamSource =
        audioContext.createMediaStreamSource(audioStream);
      const meter = audioContext.createAnalyser();
      mediaStreamSource.connect(meter);
      let startTime;
      let segmentElapsedTime = 0;

      let interval;

      setInterval(function () {
        const volume = calculateVolume(meter);
        if (volume > threshold && !interval) {
          startTime = Math.floor(performance.now());
          interval = setInterval(function () {
            segmentElapsedTime = Math.floor(performance.now()) - startTime;
          }, 100);
        }
        if (volume <= threshold && interval) {
          clearInterval(interval);
          myElapsedTime += segmentElapsedTime;
          console.log(myElapsedTime);
          segmentElapsedTime = 0;
          interval = null;
        }

        for (let i = 0; i < simplepeers.length; i++) {
          if (simplepeers[i].hasConnected) {
            simplepeers[i].simplepeer.send(
              JSON.stringify({ myElapsedTime: myElapsedTime })
            );
          }
        }
        resizeVideos();
      }, 200);
      setInterval(() => {
        for (const peer of simplepeers) {
          peer.myElapsedTime += Math.floor(Math.random() * 10);
        }
      }, 2000);

      // Now setup socket
      setupSocket();
    })
    .catch(function (err) {
      alert(err);
    });
});

function calculateVolume(meter) {
  const bufferLength = meter.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  meter.getByteTimeDomainData(dataArray);
  let sum = 0;
  for (let i = 0; i < bufferLength; i++) {
    sum += dataArray[i] ** 2;
  }
  const rms = Math.sqrt(sum / bufferLength);

  return rms;
}

function resizeVideos() {
  // for (let i = 0; i < simplepeers.length; i++) {}

  let total =
    myElapsedTime +
    simplepeers.reduce((acc, curr) => {
      return acc + curr.myElapsedTime;
    }, 0);

  /* Pseudo Code:
  assign ratios to everybody in simple peer list
  scale their videos accordingly
  
  */
  // const scale = d3.scalePow().exponent(0.8).domain([0, 1]).range([10, 1000]);
  // let total =
  //   mySpokenFor +
  //   simplepeers.map((peer) => peer.spokenFor).reduce((a, b) => a + b, 0);
  // for (let i = 0; i < simplepeers.length; i++) {
  //   // console.log(
  //   //   `${simplepeers[i].socket_id} - ${simplepeers[i].spokenFor} - ${
  //   //     simplepeers[i].spokenFor / total
  //   //   }%`
  //   // );
  //   let el = document.getElementById(`${simplepeers[i].socket_id}`);
  //   // console.log(scale(simplepeers[i].spokenFor / total));
  //   if (el != null) {
  //     el.style.width = scale(simplepeers[i].spokenFor / total);
  //     el.style.height = scale(simplepeers[i].spokenFor / total);
  //   }
  // }
  // let el = document.getElementById("myvideo");
  // if (el != null) {
  //   el.style.width = scale(mySpokenFor / total);
  //   el.style.height = scale(mySpokenFor / total);
  // }
}

/*Socket*/
function setupSocket() {
  socket = io.connect();

  socket.on("connect", function () {
    console.log("**Socket Connected**");
    console.log("My socket id:   ", socket.id);

    // Tell the server we want a list of the other users
    socket.emit("list");
  });

  socket.on("disconnect", function (data) {
    console.log("Socket disconnected");
  });

  socket.on("peer_disconnect", function (data) {
    console.log("simplepeer has disconnected " + data);
    for (let i = 0; i < simplepeers.length; i++) {
      if (simplepeers[i].socket_id == data) {
        console.log("Removing simplepeer: " + i);
        simplepeers[i].destroy();
        simplepeers.splice(i, 1);
      }
    }
  });

  // Receive listresults from server
  socket.on("listresults", function (data) {
    for (let i = 0; i < data.length; i++) {
      // Make sure it's not us
      if (data[i] != socket.id) {
        // create a new simplepeer and we'll be the "initiator"
        let simplepeer = new SimplePeerWrapper(true, data[i], socket, myStream);

        // Push into our array
        simplepeers.push(simplepeer);

        console.log(simplepeers);
      }
    }
  });

  socket.on("signal", function (to, from, data) {
    console.log("Got a signal from the server: ", to, from, data);

    // to should be us
    if (to != socket.id) {
      console.log("Socket IDs don't match");
    }

    // Look for the right simplepeer in our array
    let found = false;
    for (let i = 0; i < simplepeers.length; i++) {
      if (simplepeers[i].socket_id == from) {
        console.log("Found right object");
        // Give that simplepeer the signal
        simplepeers[i].inputsignal(data);
        found = true;
        break;
      }
    }

    if (!found) {
      console.log("Never found right simplepeer object");
      // Let's create it then, we won't be the "initiator"
      let simplepeer = new SimplePeerWrapper(false, from, socket, myStream);

      // Push into our array
      simplepeers.push(simplepeer);

      // Tell the new simplepeer that signal
      simplepeer.inputsignal(data);
    }
  });
}

// A wrapper for simplepeer as we need a bit more than it provides
class SimplePeerWrapper {
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
      resizeVideos();
    });
  }

  destroy() {
    document.body.removeChild(this.peerVideo);
  }

  inputsignal(sig) {
    this.simplepeer.signal(sig);
  }
}
