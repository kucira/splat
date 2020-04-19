import {
  generateRandomSpeed,
  generateRandomXPosition,
  drawKeypoints,
  draw3DHand,
  moveHands,
} from "./utils.js";
const cubes = [];
const hands = [];
let scene;
let cube;
let speed;
let sound;
let camera;
let handMesh;
const videoWidth = window.innerWidth;
const videoHeight = window.innerHeight;

const guiState = {
  algorithm: "single-pose",
  input: {
    mobileNetArchitecture: "0.75",
    outputStride: 16,
    imageScaleFactor: 0.5,
  },
  singlePoseDetection: {
    minPoseConfidence: 0.1,
    minPartConfidence: 0.5,
  },
  output: {
    showVideo: false,
    showPoints: true,
  },
  net: null,
};

const generateFruits = () => {
  for (var i = 0; i < 4; i++) {
    var geometry = new THREE.BoxGeometry();
    var material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    cube = new THREE.Mesh(geometry, material);
    cube.position.x = generateRandomXPosition(-10, 10);
    cube.position.y = generateRandomXPosition(-10, -5);
    speed = 0.05;
    cube.speed = speed;
    cube.soundPlayed = false;
    cube.direction = "up";
    cubes.push(cube);
    scene.add(cube);
  }
};

async function setupCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error(
      "Browser API navigator.mediaDevices.getUserMedia not available"
    );
  }

  const video = document.getElementById("video");
  video.width = videoWidth;
  video.height = videoHeight;

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: "user",
      width: videoWidth,
      height: videoHeight,
    },
  });
  video.srcObject = stream;

  return new Promise(
    (resolve) => (video.onloadedmetadata = () => resolve(video))
  );
}

async function loadVideo() {
  const video = await setupCamera();
  video.play();

  return video;
}

function detectPoseInRealTime(video, net) {
  const canvas = document.getElementById("output");
  const ctx = canvas.getContext("2d");
  // since images are being fed from a webcam
  const flipHorizontal = false;

  canvas.width = videoWidth;
  canvas.height = videoHeight;

  async function poseDetectionFrame() {
    // Scale an image down to a certain factor. Too large of an image will slow
    // down the GPU
    const imageScaleFactor = guiState.input.imageScaleFactor;
    const outputStride = +guiState.input.outputStride;

    let poses = [];
    let minPoseConfidence;
    let minPartConfidence;
    switch (guiState.algorithm) {
      case "single-pose":
        const pose = await guiState.net.estimateSinglePose(
          video,
          imageScaleFactor,
          flipHorizontal,
          outputStride
        );
        poses.push(pose);

        minPoseConfidence = +guiState.singlePoseDetection.minPoseConfidence;
        minPartConfidence = +guiState.singlePoseDetection.minPartConfidence;
        break;
    }

    ctx.clearRect(0, 0, videoWidth, videoHeight);

    poses.forEach(({ score, keypoints }) => {
      if (score >= minPoseConfidence) {
        if (guiState.output.showPoints) {
          const leftWrist = keypoints.find((k) => k.part === "leftWrist");
          const rightWrist = keypoints.find((k) => k.part === "rightWrist");

          // drawKeypoints([rightWrist, leftWrist], minPartConfidence, ctx);

          if (leftWrist) {
            const hasLeftHand = hands.find((hand) => hand.name === "leftHand");

            if (!hasLeftHand) {
              handMesh = draw3DHand();
              hands.push({
                mesh: handMesh,
                coordinates: leftWrist.position,
                name: "leftHand",
              });
              scene.add(handMesh);
            }

            const leftHandIndex = hands.findIndex(
              (hand) => hand.name === "leftHand"
            );

            leftHandIndex !== -1 &&
              (hands[leftHandIndex].coordinates = leftWrist.position);
          }

          if (rightWrist) {
            const hasRightHand = hands.find(
              (hand) => hand.name === "rightHand"
            );

            if (!hasRightHand) {
              handMesh = draw3DHand();
              hands.push({
                mesh: handMesh,
                coordinates: rightWrist.position,
                name: "rightHand",
              });
              scene.add(handMesh);
            }
            const rightHandIndex = hands.findIndex(
              (hand) => hand.name === "rightHand"
            );

            rightHandIndex !== -1 &&
              (hands[rightHandIndex].coordinates = rightWrist.position);
          }

          moveHands(hands, camera, cubes);
        }
      }
    });
    requestAnimationFrame(poseDetectionFrame);
  }

  poseDetectionFrame();
}

async function bindPage() {
  const net = await posenet.load({
    architecture: "MobileNetV1",
    outputStride: 16,
    inputResolution: 513,
    multiplier: 0.75,
  });

  let video;

  try {
    video = await loadVideo();
  } catch (e) {
    throw e;
  }

  guiState.net = net;
  detectPoseInRealTime(video, net);
}

navigator.getUserMedia =
  navigator.getUserMedia ||
  navigator.webkitGetUserMedia ||
  navigator.mozGetUserMedia;

const init = () => {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );

  var renderer = new THREE.WebGLRenderer({ alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  generateFruits();

  camera.position.z = 5;

  var animate = function () {
    requestAnimationFrame(animate);

    cubes.map((cube, index) => {
      cube.rotation.x += 0.01;
      cube.rotation.y += 0.01;

      if (cube.direction === "up") {
        cube.position.y += cube.speed;
      }

      if (cube.position.y > 0 && !cube.soundPlayed && cube.direction === "up") {
        sound.play();
        cube.soundPlayed = true;
      }

      if (cube.position.y > 4) {
        cube.direction = "down";
      }

      if (cube.direction === "down") {
        cube.position.y -= cube.speed;
      }

      if (cube.position.y < -10) {
        scene.remove(cube);
        cubes.splice(index, 1);
      }
    });

    if (cubes.length === 0) {
      cube.direction = "up";
      generateFruits();
    }

    renderer.render(scene, camera);
  };

  animate();
};

window.onload = () => {
  // init();
  // bindPage();
};

window.onclick = () => {
  sound = new Howl({
    src: ["fruit.m4a"],
  });
  init();
  bindPage();
};
