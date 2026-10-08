// capture.js
const photoModal = document.getElementById('photo-modal');
const closeModal = document.getElementById('close-modal');
const capturedImage = document.getElementById('captured-image');
const downloadLink = document.getElementById('download-link');
const qrcodeContainer = document.getElementById('qrcode');

function initCapture(videoElement, canvasElement) {
  const btnCapture = document.getElementById('btn-capture');

  if (!btnCapture) return;

  btnCapture.addEventListener('click', () => {
    try {
      if (!videoElement || videoElement.readyState < 2) {
        alert("กล้องยังไม่พร้อมใช้งาน กรุณารอสักครู่");
        return;
      }

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvasElement.width || 1280;
      tempCanvas.height = canvasElement.height || 720;
      const tempCtx = tempCanvas.getContext('2d');

      // กลับด้านภาพส่องกระจก
      tempCtx.translate(tempCanvas.width, 0);
      tempCtx.scale(-1, 1);

      // วาดภาพวิดีโอและลายเส้นมือ
      tempCtx.drawImage(videoElement, 0, 0, tempCanvas.width, tempCanvas.height);
      tempCtx.drawImage(canvasElement, 0, 0, tempCanvas.width, tempCanvas.height);

      // 1. ภาพความละเอียดสูงสำหรับแสดงผลและดาวน์โหลด
      const imageBase64 = tempCanvas.toDataURL('image/png');
      capturedImage.src = imageBase64;
      downloadLink.href = imageBase64;

      // 2. ย่อขนาดภาพให้เล็กมากๆ (160x90) เพื่อให้ Base64 สั้นลงจนกล้องมือถือสแกนติด
      const smallCanvas = document.createElement('canvas');
      smallCanvas.width = 160;
      smallCanvas.height = 90;
      const smallCtx = smallCanvas.getContext('2d');
      smallCtx.drawImage(tempCanvas, 0, 0, 160, 90);
      
      // แปลงเป็น JPG ความละเอียดต่ำ
      const lowResBase64 = smallCanvas.toDataURL('image/jpeg', 0.2);

      qrcodeContainer.innerHTML = "";
      if (typeof QRCode !== "undefined") {
        new QRCode(qrcodeContainer, {
          text: lowResBase64,
          width: 160,
          height: 160,
          correctLevel: QRCode.CorrectLevel.L // ตั้งระดับ Error Correction ต่ำสุดเพื่อให้ลาย QR หยาบลง สแกนง่ายขึ้น
        });
      }

      photoModal.style.display = "flex";
    } catch (err) {
      console.error("Capture Error:", err);
      alert("ไม่สามารถแคปภาพได้: " + err.message);
    }
  });

  if (closeModal) {
    closeModal.addEventListener('click', () => { photoModal.style.display = "none"; });
  }

  window.addEventListener('click', (e) => {
    if (e.target === photoModal) photoModal.style.display = "none";
  });
}
