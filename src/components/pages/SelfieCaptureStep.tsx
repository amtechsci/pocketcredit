import { useState, useRef, useEffect } from 'react';
import { Camera, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { apiService } from '../../services/api';
import { toast } from 'sonner';

interface SelfieCaptureStepProps {
  applicationId: number;
  onComplete: (verified: boolean) => void;
  saving: boolean;
  progress: {
    selfie_captured: boolean;
    selfie_verified: boolean;
  };
}

export const SelfieCaptureStep = ({ 
  applicationId, 
  onComplete, 
  saving,
  progress 
}: SelfieCaptureStepProps) => {
  const [showNote, setShowNote] = useState(!progress.selfie_captured);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    return () => {
      // Cleanup: stop camera stream when component unmounts
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'user', // Front camera
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast.error('Failed to access camera. Please allow camera permissions.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const captureSelfie = () => {
    if (!videoRef.current || !canvasRef.current) return;

    setIsCapturing(true);
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw video frame to canvas
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const imageData = canvas.toDataURL('image/jpeg', 0.9);
      setCapturedImage(imageData);
      stopCamera();
    }
    
    setIsCapturing(false);
  };

  const retakeSelfie = () => {
    setCapturedImage(null);
    setVerificationResult(null);
    setRetryCount(0);
    startCamera();
  };

  const verifySelfie = async () => {
    if (!capturedImage) return;

    setIsVerifying(true);
    setVerificationResult(null);

    try {
      // Convert base64 to blob
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      const file = new File([blob], `selfie-${applicationId}-${Date.now()}.jpg`, {
        type: 'image/jpeg'
      });

      // Upload selfie and verify
      const uploadResponse = await apiService.uploadSelfieForVerification(applicationId, file);
      
      if (uploadResponse.success) {
        // Mock face match verification - will be replaced with actual Cashfree API
        // For now, simulate verification with 80% success rate
        const mockVerification = Math.random() > 0.2;
        
        if (mockVerification) {
          setVerificationResult({
            success: true,
            message: 'Face match verified successfully'
          });
          toast.success('Selfie verified successfully');
          
          // Wait a moment then complete
          setTimeout(() => {
            onComplete(true);
          }, 1500);
        } else {
          setVerificationResult({
            success: false,
            message: 'Face match failed. Please try again with better lighting and ensure your face is clearly visible.'
          });
          toast.error('Face match verification failed');
          setRetryCount(prev => prev + 1);
        }
      } else {
        throw new Error(uploadResponse.message || 'Failed to upload selfie');
      }
    } catch (error: any) {
      console.error('Error verifying selfie:', error);
      toast.error(error.message || 'Failed to verify selfie');
      setVerificationResult({
        success: false,
        message: 'Verification failed. Please try again.'
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // Show note screen first
  if (showNote) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-blue-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Selfie Verification</h2>
          <p className="text-gray-600">
            Please read the instructions before proceeding
          </p>
        </div>

        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-6">
            <div className="space-y-4">
              <h3 className="font-semibold text-lg mb-4">Important Instructions:</h3>
              <ul className="space-y-3 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold flex-shrink-0">1.</span>
                  <span>Ensure you are in a well-lit area</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold flex-shrink-0">2.</span>
                  <span>Remove any face coverings (mask, sunglasses, etc.)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold flex-shrink-0">3.</span>
                  <span>Look directly at the camera</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold flex-shrink-0">4.</span>
                  <span>Keep your face centered in the frame</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold flex-shrink-0">5.</span>
                  <span>Your selfie will be matched with your DigiLocker photo</span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button
            onClick={() => {
              setShowNote(false);
              startCamera();
            }}
            className="min-w-[120px]"
          >
            <Camera className="w-4 h-4 mr-2" />
            Start Camera
          </Button>
        </div>
      </div>
    );
  }

  // Camera view
  if (!capturedImage) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <Camera className="w-16 h-16 text-blue-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Capture Selfie</h2>
          <p className="text-gray-600">
            Position your face in the frame and click capture
          </p>
        </div>

        <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          {!stream && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <Button onClick={startCamera} variant="outline">
                <Camera className="w-4 h-4 mr-2" />
                Start Camera
              </Button>
            </div>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />

        {stream && (
          <div className="flex justify-center gap-4">
            <Button
              onClick={captureSelfie}
              disabled={isCapturing}
              className="min-w-[150px]"
            >
              {isCapturing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Camera className="w-4 h-4 mr-2" />
              )}
              Capture
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Captured image preview with verification
  return (
    <div className="space-y-6">
      <div className="text-center">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Selfie Captured</h2>
        <p className="text-gray-600">
          Review your selfie and proceed with verification
        </p>
      </div>

      <div className="relative bg-gray-100 rounded-lg overflow-hidden mx-auto max-w-md" style={{ aspectRatio: '4/3' }}>
        <img
          src={capturedImage}
          alt="Captured selfie"
          className="w-full h-full object-cover"
        />
      </div>

      {verificationResult && (
        <Card className={`border-l-4 ${
          verificationResult.success 
            ? 'bg-green-50 border-green-500' 
            : 'bg-red-50 border-red-500'
        }`}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              {verificationResult.success ? (
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              )}
              <p className="text-sm text-gray-700">{verificationResult.message}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-center gap-4">
        {!verificationResult || !verificationResult.success ? (
          <>
            <Button
              onClick={retakeSelfie}
              variant="outline"
              disabled={isVerifying}
            >
              <X className="w-4 h-4 mr-2" />
              Retake
            </Button>
            <Button
              onClick={verifySelfie}
              disabled={isVerifying || saving}
              className="min-w-[150px]"
            >
              {isVerifying ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              {isVerifying ? 'Verifying...' : 'Verify & Continue'}
            </Button>
          </>
        ) : (
          <div className="text-center w-full">
            <p className="text-green-600 font-medium mb-4">
              ✓ Verification successful!
            </p>
          </div>
        )}
      </div>

      {retryCount > 0 && (
        <p className="text-center text-sm text-gray-500">
          Retry attempt: {retryCount}
        </p>
      )}
    </div>
  );
};




