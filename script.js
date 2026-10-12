const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');

// เรียกใช้งานฟังก์ชันที่โหลดมาจาก capture.js
initCapture(videoElement, canvasElement);

const bandDisplay = document.getElementById('band-display');
const songDisplay = document.getElementById('song-display');

let currentBand = "";
let currentSongIndex = 0;

// ==========================================
// ระบบนับเฟรม (Hold Counter) 40 เฟรม
// ==========================================
const HOLD_TARGET = 40; 

let counters = {
  CARABAO: 0,
  THREEMANDOWN: 0,
  SLOTMACHINE: 0,
  Z9: 0,
  SILLYFOOLS: 0,
  FIST: 0,
  PAUSE_ONE_FINGER: 0,
  RESUME_TWO_FINGERS: 0,
  RESET_PALM: 0 // ตัวนับเวลาสำหรับกำมือ 2 ข้างเพื่อรีเซ็ต
};

let isCooldown = false;
const currentAudio = new Audio();

// คลังเพลงของแต่ละวง
const bandPlaylist = {
  CARABAO: {
    bandName: "คาราบาว (Carabao)",
    songs: [
      { songName: "วณิพก", audioUrl: "songs/carabao1-edit.mp3" },
      { songName: "ยายสำอาง", audioUrl: "songs/carabao2-edit.mp3" },
      { songName: "เมดอินไทยแลนด์", audioUrl: "songs/carabao3-edit.mp3" }
    ]
  },
  THREEMANDOWN: {
    bandName: "Three Man Down",
    songs: [
      { songName: "ฝนตกไหม", audioUrl: "songs/tmd3-edit1.mp3" },
      { songName: "ถ้าเธอรักใครจริง", audioUrl: "songs/tmd3-edit2.mp3" },
      { songName: "ข้างกัน", audioUrl: "songs/tmd3-edit3.mp3" }
    ]
  },
  SLOTMACHINE: {
    bandName: "Slot Machine",
    songs: [
      { songName: "ผ่าน", audioUrl: "songs/slot-edit1.mp3" },
      { songName: "จันทร์เจ้า", audioUrl: "songs/slot-edit2.mp3" },
      { songName: "เคลิ้ม", audioUrl: "songs/slot-edit3.mp3" }
    ]
  },
  Z9: {
    bandName: "Z9",
    songs: [
      { songName: "ทำใจไม่ได้", audioUrl: "songs/z9-edit1.mp3" },
      { songName: "รักใครไม่เป็น", audioUrl: "songs/z9-edit2.mp3" },
      { songName: "บทสรุปสุดท้าย", audioUrl: "songs/z9-edit3.mp3" }
    ]
  },
  SILLYFOOLS: {
    bandName: "Silly Fools",
    songs: [
      { songName: "เพียงรัก", audioUrl: "songs/sf-edit1.mp3" },
      { songName: "อย่าบอกว่ารัก", audioUrl: "songs/sf-edit2.mp3" },
      { songName: "ไหนว่าไม่หลอกกัน", audioUrl: "songs/sf-edit3.mp3" }
    ]
  }
};

// ฟังก์ชันคำนวณระยะห่างระหว่างจุด 2 จุด
function getDistance(p1, p2) {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

// เช็กว่ามือนั้นๆ กำมืออยู่หรือไม่
function isFist(landmarks) {
  if (!landmarks || landmarks.length < 21) return false;
  const indexTip = landmarks[8];
  const middleTip = landmarks[12];
  const ringTip = landmarks[16];
  const pinkyTip = landmarks[20];

  const indexPip = landmarks[6];
  const middlePip = landmarks[10];
  const ringPip = landmarks[14];
  const pinkyPip = landmarks[18];

  return indexTip.y > indexPip.y && 
         middleTip.y > middlePip.y && 
         ringTip.y > ringPip.y && 
         pinkyTip.y > pinkyPip.y;
}

// 1. ตรวจจับสัญลักษณ์มือเดี่ยว
function detectSingleHandGesture(landmarks) {
  if (!landmarks || landmarks.length < 21) return "UNKNOWN";

  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const middleTip = landmarks[12];
  const ringTip = landmarks[16];
  const pinkyTip = landmarks[20];

  const indexPip = landmarks[6];
  const middlePip = landmarks[10];
  const ringPip = landmarks[14];
  const pinkyPip = landmarks[18];

  const isIndexUp = indexTip.y < indexPip.y;
  const isMiddleUp = middleTip.y < middlePip.y;
  const isRingUp = ringTip.y < ringPip.y;
  const isPinkyUp = pinkyTip.y < pinkyPip.y;

  const isIndexDown = indexTip.y > indexPip.y;
  const isMiddleDown = middleTip.y > middlePip.y;
  const isRingDown = ringTip.y > ringPip.y;
  const isPinkyDown = pinkyTip.y > pinkyPip.y;

  // 🤟 1.1 Three Man Down (ชู 3 นิ้ว: ชี้ + กลาง + นาง / ก้อยพับลง)
  if (isIndexUp && isMiddleUp && isRingUp && isPinkyDown) {
    return "THREEMANDOWN";
  }

  // ☝️ 1.2 ชู 1 นิ้วขึ้นฟ้า (นิ้วชี้) -> หยุดเพลง (Pause)
  if (isIndexUp && isMiddleDown && isRingDown && isPinkyDown) {
    return "PAUSE_ONE_FINGER";
  }

  // ✌️ 1.3 ชู 2 นิ้วขึ้นฟ้า (ชี้ + กลาง) -> เล่นเพลงต่อ (Resume)
  if (isIndexUp && isMiddleUp && isRingDown && isPinkyDown) {
    return "RESUME_TWO_FINGERS";
  }

  // ✊ 1.4 กำมือข้างเดียว (Fist) -> ข้ามเพลง
  if (isIndexDown && isMiddleDown && isRingDown && isPinkyDown) {
    return "FIST";
  }

  // 🤘 1.5 Silly Fools (Rock Sign: ชี้ + ก้อย)
  if (isIndexUp && isPinkyUp && isMiddleDown && isRingDown) return "SILLYFOOLS";

  // 👌 1.6 Z9 (โป้งแตะชี้เป็นวงกลม < 0.045)
  const thumbIndexDist = getDistance(thumbTip, indexTip);
  if (thumbIndexDist < 0.045 && isMiddleUp && isRingUp && isPinkyUp) return "Z9";

  // 🤙 1.7 Carabao (Shaka: โป้ง + ก้อย)
  const isThumbOut = Math.abs(thumbTip.x - indexPip.x) > 0.12;
  if (isThumbOut && isPinkyUp && isIndexDown && isMiddleDown) return "CARABAO";

  return "UNKNOWN";
}

// 2. ตรวจจับสัญลักษณ์ 2 มือ (Slot Machine 🔺 และ กำมือ 2 ข้าง ✊✊)
function detectTwoHandGesture(hand1, hand2) {
  if (!hand1 || hand1.length < 21 || !hand2 || hand2.length < 21) return "UNKNOWN";

  // ✊✊ กำมือทั้งสองข้างพร้อมกัน -> รีเซ็ตระบบเป็นศูนย์
  if (isFist(hand1) && isFist(hand2)) {
    return "RESET_PALM";
  }

  // 🔺 สามเหลี่ยม Slot Machine
  const h1IndexTip = hand1[8];
  const h1ThumbTip = hand1[4];
  const h1IndexPip = hand1[6];

  const h2IndexTip = hand2[8];
  const h2ThumbTip = hand2[4];
  const h2IndexPip = hand2[6];

  const indexDistance = getDistance(h1IndexTip, h2IndexTip);
  const thumbDistance = getDistance(h1ThumbTip, h2ThumbTip);

  const isH1IndexUp = h1IndexTip.y < h1IndexPip.y;
  const isH2IndexUp = h2IndexTip.y < h2IndexPip.y;

  if (indexDistance < 0.07 && thumbDistance < 0.08 && isH1IndexUp && isH2IndexUp) {
    return "SLOTMACHINE";
  }

  return "UNKNOWN";
}

// 3. ประมวลผลแต่ละเฟรมจากกล้อง
function onResults(results) {
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  let detectedGesture = "UNKNOWN";

  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    for (let i = 0; i < results.multiHandLandmarks.length; i++) {
      const landmarks = results.multiHandLandmarks[i];
      
      if (typeof HAND_CONNECTIONS !== 'undefined' && window.drawConnectors) {
        drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, { color: '#eff3f2', lineWidth: 3 });
        drawLandmarks(canvasCtx, landmarks, { color: '#1eff00', lineWidth: 1, radius: 4 });
      }
    }

    // ตรวจจับกรณีชู 2 มือพร้อมกันก่อน
    if (results.multiHandLandmarks.length === 2) {
      detectedGesture = detectTwoHandGesture(
        results.multiHandLandmarks[0],
        results.multiHandLandmarks[1]
      );
    }

    // ถ้าไม่ใช่ท่า 2 มือ ค่อยเช็กท่ามือเดียว
    if (detectedGesture === "UNKNOWN") {
      detectedGesture = detectSingleHandGesture(results.multiHandLandmarks[0]);
    }
  }

  handleGestureWithDelay(detectedGesture);
  canvasCtx.restore();
}

// 4. จัดการระบบนับเวลาค้างมือ
function handleGestureWithDelay(gesture) {
  for (const key in counters) {
    if (key === gesture) {
      counters[key]++;
    } else {
      counters[key] = 0;
    }
  }

  if (counters[gesture] >= HOLD_TARGET) {
    counters[gesture] = 0;

    // --- ✊✊ 4.0 กำมือ 2 ข้างพร้อมกันเพื่อรีเซ็ตระบบกลับเป็นศูนย์ ---
    if (gesture === "RESET_PALM") {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentBand = "";
      currentSongIndex = 0;

      bandDisplay.innerText = "กำลังรอสัญลักษณ์มือ...";
      songDisplay.innerText = "รีเซ็ตระบบเรียบร้อย";
      return;
    }

    // --- ☝️ 4.1 ชู 1 นิ้วเพื่อหยุดเพลงชั่วคราว (Pause) ---
    if (gesture === "PAUSE_ONE_FINGER") {
      if (currentBand !== "") {
        currentAudio.pause();
        const bandData = bandPlaylist[currentBand];
        const songData = bandData.songs[currentSongIndex];
        songDisplay.innerText = `หยุดเพลงชั่วคราว: ${songData.songName}`;
      }
      return;
    }

    // --- ✌️ 4.2 ชู 2 นิ้วเพื่อเล่นเพลงต่อ (Resume) ---
    if (gesture === "RESUME_TWO_FINGERS") {
      if (!currentBand) {
        currentBand = "CARABAO";
        currentSongIndex = 0;
      }

      if (currentBand && bandPlaylist[currentBand]) {
        const bandData = bandPlaylist[currentBand];
        const songData = bandData.songs[currentSongIndex];

        if (!currentAudio.src || currentAudio.src === "") {
          currentAudio.src = songData.audioUrl;
        }

        currentAudio.play().then(() => {
          bandDisplay.innerText = bandData.bandName;
          songDisplay.innerText = `กำลังเล่น (${currentSongIndex + 1}/${bandData.songs.length}): ${songData.songName}`;
        }).catch(err => {
          console.log("Audio Playback Error:", err);
          songDisplay.innerText = "คลิกที่หน้าจอ 1 ครั้งเพื่ออนุญาตให้เล่นเสียง";
        });
      }
      return;
    }

    // --- ✊ 4.3 กำมือข้างเดียวเพื่อเปลี่ยนเพลง ---
    if (gesture === "FIST") {
      if (!isCooldown && currentBand && bandPlaylist[currentBand]) {
        isCooldown = true;
        const songsList = bandPlaylist[currentBand].songs;
        currentSongIndex = (currentSongIndex + 1) % songsList.length;
        playCurrentSong();

        setTimeout(() => { isCooldown = false; }, 1500);
      }
      return;
    }

    // --- 4.4 สลับวงดนตรี ---
    if (gesture !== "UNKNOWN" && gesture !== currentBand) {
      currentBand = gesture;
      currentSongIndex = 0;
      playCurrentSong();
    }
  }
}

// 5. สั่งเล่น Audio
function playCurrentSong() {
  if (!currentBand || !bandPlaylist[currentBand]) return;

  const bandData = bandPlaylist[currentBand];
  const songData = bandData.songs[currentSongIndex];

  bandDisplay.innerText = bandData.bandName;
  songDisplay.innerText = `กำลังเล่น (${currentSongIndex + 1}/${bandData.songs.length}): ${songData.songName}`;

  currentAudio.src = songData.audioUrl;
  currentAudio.play().catch(err => console.log("Audio Playback Error:", err));
}

// 6. ตั้งค่า MediaPipe Hands
const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
  maxNumHands: 2,
  modelComplexity: 1,
  minDetectionConfidence: 0.6,
  minTrackingConfidence: 0.6
});

hands.onResults(onResults);

const camera = new Camera(videoElement, {
  onFrame: async () => {
    await hands.send({ image: videoElement });
  },
  width: 1280,
  height: 720
});

camera.start().catch(err => console.error("เปิดกล้องไม่ได้:", err));