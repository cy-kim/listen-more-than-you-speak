# Listen More Than You Speak



This is an alternative video calling platform. The longer you speak, the bigger your video becomes, taking up "physical" space.
![demo](https://user-images.githubusercontent.com/43127162/211378085-fe8ad9d3-89e6-4c02-8062-f3b0852f5bb0.gif)




Deployment is currently down since Heroku's end to its free service.


# Stack
WebRTC (Simple Peer lib), Socket.io, Node (Express), JS, HTML, CSS, Heroku.

# Notes

Please use incognito mode to avoid extensions interfering with the video call. 

Edge case: if your machine is on a network with symmetric NAT configuration, it will not work due to this project’s STUN server setup.
