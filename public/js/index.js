let myStream = null;
//audio stuff
let mySpokenFor = 0;
let myVolume = 0;
let simplepeers = [];
var socket;

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

      setInterval(function () {
        const volume = calculateVolume(meter);
        console.log("Volume:", volume);
      }, 200);

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
//https://github.com/cwilso/volume-meter
// function createAudioMeter(audioContext, clipLevel, averaging, clipLag) {
//   const processor = audioContext.createScriptProcessor(512);
//   processor.onaudioprocess = volumeAudioProcess;
//   processor.clipping = false;
//   processor.lastClip = 0;
//   processor.volume = 0;
//   processor.clipLevel = clipLevel || 0.98;
//   processor.averaging = averaging || 0.95;
//   processor.clipLag = clipLag || 750;

//   // this will have no effect, since we don't copy the input to the output,
//   // but works around a current Chrome bug.
//   processor.connect(audioContext.destination);

//   processor.checkClipping = function () {
//     if (!this.clipping) {
//       return false;
//     }
//     if (this.lastClip + this.clipLag < window.performance.now()) {
//       this.clipping = false;
//     }
//     return this.clipping;
//   };

//   processor.shutdown = function () {
//     this.disconnect();
//     this.onaudioprocess = null;
//   };

//   return processor;
// }

// function volumeAudioProcess(event) {
//   const buf = event.inputBuffer.getChannelData(0);
//   const bufLength = buf.length;
//   let sum = 0;
//   let x;

//   // Do a root-mean-square on the samples: sum up the squares...
//   for (var i = 0; i < bufLength; i++) {
//     x = buf[i];
//     if (Math.abs(x) >= this.clipLevel) {
//       this.clipping = true;
//       this.lastClip = window.performance.now();
//     }
//     sum += x * x;
//   }

//   // ... then take the square root of the sum.
//   const rms = Math.sqrt(sum / bufLength);

//   // Now smooth this out with the averaging factor applied
//   // to the previous sample - take the max here because we
//   // want "fast attack, slow release."
//   this.volume = Math.max(rms, this.volume * this.averaging);
//   this.mappedVolume = Math.floor(mapRange(this.volume, 0, 1, 0, 50));
//   //document.getElementById("myAudioValue").innerHTML = this.mappedVolume;
//   myVolume = this.mappedVolume;
//   if (myVolume > 3) {
//     mySpokenFor += myVolume;
//     for (let i = 0; i < simplepeers.length; i++) {
//       if (simplepeers[i].hasConnected) {
//         simplepeers[i].simplepeer.send(JSON.stringify({ myVolume: myVolume }));
//       }
//     }
//     resizeVideos();
//   }
// }

function mapRange(value, a, b, c, d) {
  // first map value from (a..b) to (0..1)
  value = (value - a) / (b - a);
  // then map it from (0..1) to (c..d) and return it
  return c + value * (d - c);
}

function resizeVideos() {
  const scale = d3.scalePow().exponent(0.8).domain([0, 1]).range([10, 1000]);
  let total =
    mySpokenFor +
    simplepeers.map((peer) => peer.spokenFor).reduce((a, b) => a + b, 0);

  for (let i = 0; i < simplepeers.length; i++) {
    // console.log(
    //   `${simplepeers[i].socket_id} - ${simplepeers[i].spokenFor} - ${
    //     simplepeers[i].spokenFor / total
    //   }%`
    // );
    let el = document.getElementById(`${simplepeers[i].socket_id}`);
    // console.log(scale(simplepeers[i].spokenFor / total));
    if (el != null) {
      el.style.width = scale(simplepeers[i].spokenFor / total);
      el.style.height = scale(simplepeers[i].spokenFor / total);
    }
  }
  let el = document.getElementById("myvideo");
  if (el != null) {
    el.style.width = scale(mySpokenFor / total);
    el.style.height = scale(mySpokenFor / total);
  }
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

    this.spokenFor = 0;

    this.hasConnected = false;

    // simplepeer generates signals which need to be sent across socket
    this.simplepeer.on("signal", (data) => {
      this.socket.emit("signal", this.socket_id, this.socket.id, data);
    });

    // When we have a connection, send our stream
    this.simplepeer.on("connect", () => {
      console.log("CONNECT");
      this.hasConnected = true;
      //console.log(this.simplepeer);

      // Let's give them our stream
      this.simplepeer.addStream(stream).catch(console.log("NOT STREAMING"));

      console.log("Send our stream");
    });

    // Stream coming in to us
    this.simplepeer.on("stream", (stream) => {
      //console.log(stream.getAudioTracks());

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
      const { myVolume } = JSON.parse(data);
      this.spokenFor += myVolume;
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
