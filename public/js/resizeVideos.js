import { simplepeers } from "./setupSocket.js";
export function resizeVideos(myElapsedTime) {
  let total =
    myElapsedTime +
    simplepeers.reduce((acc, curr) => {
      return acc + curr.myElapsedTime;
    }, 0);

  //TODO: callibrate sizing

  simplepeers.forEach((peer) => {
    let el = document.getElementById(`${peer.socket_id}`);
    if (el != null) {
      el.style.width = (peer.myElapsedTime / total) * 500;
      el.style.height = (peer.myElapsedTime / total) * 500;
    }
  });

  let el = document.getElementById("myvideo");
  if (el != null) {
    el.style.width = (myElapsedTime / total) * 500;
    el.style.height = (myElapsedTime / total) * 500;
  }
}
