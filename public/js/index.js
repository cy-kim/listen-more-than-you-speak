import { setupSocket, simplepeers } from "./setupSocket.js";
import { resizeVideos } from "./resizeVideos.js";

//TODO: set customizable threshold of mic before you enter the chat
let myStream = null;
let threshold = 127.8;
let myElapsedTime = 0;

window.addEventListener("load", function () {
  let constraints = {
    audio: true,
    video: true,
  };
  navigator.mediaDevices
    .getUserMedia(constraints)
    .then(function (stream) {
      myStream = stream;

      const video = document.getElementById("myvideo");
      video.srcObject = stream;

      video.onloadedmetadata = function (e) {
        video.play();
      };
      const audioStream = new MediaStream(stream.getAudioTracks());
      const audioContext = new window.AudioContext();

      // Creating audio meter
      const mediaStreamSource =
        audioContext.createMediaStreamSource(audioStream);
      const meter = audioContext.createAnalyser();
      mediaStreamSource.connect(meter);
      setupSocket(myStream);

      let startTime;
      let segmentElapsedTime = 0;
      let interval;

      setInterval(() => {
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
          // console.log("myElapsed:", myElapsedTime);
          segmentElapsedTime = 0;
          interval = null;
        }
      }, 200);

      setInterval(() => {
        for (let i = 0; i < simplepeers.length; i++) {
          if (simplepeers[i].hasConnected) {
            simplepeers[i].simplepeer.send(
              JSON.stringify({ myElapsedTime: myElapsedTime })
            );
          }
        }

        resizeVideos(myElapsedTime);
      }, 2000);
    })
    .catch((err) => {
      alert(err);
    });
});

const calculateVolume = (meter) => {
  const bufferLength = meter.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  meter.getByteTimeDomainData(dataArray);
  let sum = 0;
  for (let i = 0; i < bufferLength; i++) {
    sum += dataArray[i] ** 2;
  }
  const rms = Math.sqrt(sum / bufferLength);

  return rms;
};
