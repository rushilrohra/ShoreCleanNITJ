import { useState, useEffect, useRef } from 'react'

export default function CameraCapture({ onCapture, onCancel }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const [phase, setPhase] = useState('preview') // 'preview' | 'captured' | 'error'
  const [capturedUrl, setCapturedUrl] = useState(null)
  const [capturedBlob, setCapturedBlob] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  // Start camera on mount
  useEffect(() => {
    let active = true
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    })
      .then((stream) => {
        if (!active) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      })
      .catch((err) => {
        if (!active) return
        setPhase('error')
        setErrorMsg(
          err.name === 'NotAllowedError'
            ? 'Camera permission denied. Please allow camera access and try again.'
            : 'Could not start camera. Please try again.'
        )
      })

    return () => {
      active = false
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const takePhoto = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
      setPhase('error')
      setErrorMsg('Camera is not ready yet. Please try again in a moment.')
      return
    }
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    canvas.getContext('2d').drawImage(video, 0, 0)
    canvas.toBlob((blob) => {
      if (!blob) {
        setPhase('error')
        setErrorMsg('Could not capture photo. Please try again.')
        return
      }
      const url = URL.createObjectURL(blob)
      setCapturedBlob(blob)
      setCapturedUrl(url)
      setPhase('captured')
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }, 'image/jpeg', 0.92)
  }

  const retake = () => {
    if (capturedUrl) URL.revokeObjectURL(capturedUrl)
    setCapturedUrl(null)
    setCapturedBlob(null)
    setPhase('preview')
    // Restart camera
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then((stream) => {
        streamRef.current = stream
        videoRef.current.srcObject = stream
      })
  }

  const confirm = () => {
    if (!capturedBlob) {
      setPhase('error')
      setErrorMsg('No captured photo found. Please retake and try again.')
      return
    }
    const file = new File([capturedBlob], 'registration-photo.jpg', { type: 'image/jpeg' })
    onCapture(file)
  }

  useEffect(() => {
    return () => {
      if (capturedUrl) URL.revokeObjectURL(capturedUrl)
    }
  }, [capturedUrl])

  // STYLES (inline — no external CSS needed)
  const overlayStyle = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
    zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexDirection: 'column', padding: '24px',
  }
  const mediaStyle = {
    width: '100%', maxWidth: '400px', borderRadius: '16px',
    border: '3px solid #2176ae', display: 'block',
  }

  return (
    <div style={overlayStyle}>
      <p style={{ color: '#87d8f7', fontSize: 13, marginBottom: 12, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        Registration Photo
      </p>

      {phase === 'error' && (
        <>
          <div style={{ color: '#e05c45', fontSize: 15, textAlign: 'center', marginBottom: 16 }}>{errorMsg}</div>
          <button onClick={onCancel} className="btn btn-secondary">Go Back</button>
        </>
      )}

      {phase === 'preview' && (
        <>
          <video ref={videoRef} autoPlay playsInline muted style={mediaStyle} />
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, margin: '12px 0', textAlign: 'center' }}>
            Look straight at the camera. Your face must be clearly visible.
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={onCancel} className="btn btn-ghost btn-sm" style={{ color: 'white' }}>Cancel</button>
            <button onClick={takePhoto} className="btn btn-primary">📷 Take Photo</button>
          </div>
        </>
      )}

      {phase === 'captured' && (
        <>
          <img src={capturedUrl} alt="Captured" style={mediaStyle} />
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, margin: '12px 0', textAlign: 'center' }}>
            Make sure your face is clearly visible before confirming.
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={retake} className="btn btn-secondary btn-sm">Retake</button>
            <button onClick={confirm} className="btn btn-primary">✓ Use This Photo</button>
          </div>
        </>
      )}

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  )
}
