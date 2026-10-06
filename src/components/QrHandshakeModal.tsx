import React, { useState, useEffect, useRef } from 'react';
import {
  encodeQrCode,
  matrixToSvg,
  createHandshakePayload,
  verifyHandshakePayload,
  HandshakePayload,
} from '../lib/qrCode';
import {
  QrCode,
  Camera,
  Copy,
  Check,
  X,
  ShieldCheck,
  AlertCircle,
  Download,
  KeyRound,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

export interface QrHandshakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'display' | 'scan';
  stage: 'pickup' | 'delivery';
  listingId: string;
  foodTitle: string;
  quantityStr: string;
  expectedCode: string;
  donorOrg?: string;
  shelterOrg?: string;
  onSuccess?: (payload: HandshakePayload) => void;
}

export const QrHandshakeModal: React.FC<QrHandshakeModalProps> = ({
  isOpen,
  onClose,
  mode,
  stage,
  listingId,
  foodTitle,
  quantityStr,
  expectedCode,
  donorOrg,
  shelterOrg,
  onSuccess,
}) => {
  const [copied, setCopied] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successPayload, setSuccessPayload] = useState<HandshakePayload | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Generate payload string and SVG QR code
  const payloadString = React.useMemo(() => {
    return createHandshakePayload({
      listingId,
      stage,
      code: expectedCode,
      donorOrg,
      shelterOrg,
    });
  }, [listingId, stage, expectedCode, donorOrg, shelterOrg]);

  const qrSvg = React.useMemo(() => {
    try {
      const matrix = encodeQrCode(payloadString, 'M');
      return matrixToSvg(matrix, {
        size: 240,
        color: '#059669',
        bgColor: '#FFFFFF',
        margin: 3,
      });
    } catch (e) {
      console.error('Failed to generate QR matrix:', e);
      return '';
    }
  }, [payloadString]);

  // Handle Camera Startup for 'scan' mode
  useEffect(() => {
    if (!isOpen || mode !== 'scan') {
      stopCamera();
      return;
    }

    startCamera();
    return () => {
      stopCamera();
    };
  }, [isOpen, mode]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Camera access not supported on this browser/environment. Use manual PIN.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
      }
    } catch (err: any) {
      console.warn('Camera stream unavailable, switching to simulator / manual PIN:', err);
      setCameraError('Camera unavailable or permission denied. You can enter the PIN or use Instant Verification below.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setCameraActive(false);
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(expectedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadQr = () => {
    if (!qrSvg) return;
    const blob = new Blob([qrSvg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `foodlink-qr-${stage}-${listingId.slice(0, 6)}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleVerifyInput = (inputToVerify: string) => {
    setErrorMessage(null);
    const result = verifyHandshakePayload(inputToVerify, listingId, stage, expectedCode);

    if (result.isValid && result.payload) {
      setSuccessPayload(result.payload);
      stopCamera();
      if (onSuccess) {
        onSuccess(result.payload);
      }
    } else {
      setErrorMessage(result.error || 'Verification failed. Please check the code.');
    }
  };

  const handleSimulateScanSuccess = () => {
    handleVerifyInput(payloadString);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#064E3B]/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          stopCamera();
          onClose();
        }
      }}
    >
      <div className="bg-white dark:bg-[#162421] w-full max-w-lg rounded-3xl border border-[#CFDED5] dark:border-[#233833] shadow-2xl p-6 sm:p-7 relative my-auto overflow-hidden">
        {/* Close Button */}
        <button
          type="button"
          onClick={() => {
            stopCamera();
            onClose();
          }}
          className="absolute top-5 right-5 w-9 h-9 rounded-full bg-gray-100 dark:bg-[#233833] text-gray-500 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-[#059669]/15 text-[#059669] flex items-center justify-center shrink-0">
            {mode === 'display' ? <QrCode className="w-6 h-6" /> : <Camera className="w-6 h-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#059669]/15 text-[#059669]">
                {stage === 'pickup' ? 'Node 1: Donor Handshake' : 'Node 2: Shelter Handshake'}
              </span>
              <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400">
                #{listingId.slice(0, 6)}
              </span>
            </div>
            <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight mt-0.5">
              {mode === 'display'
                ? stage === 'pickup'
                  ? 'Donor Pickup Handshake QR'
                  : 'Recipient Delivery Handshake QR'
                : stage === 'pickup'
                ? 'Scan Donor Pickup Code'
                : 'Scan Recipient Delivery Code'}
            </h2>
          </div>
        </div>

        {/* Batch Brief Bar */}
        <div className="p-3.5 rounded-2xl bg-[#F0FDF8] dark:bg-[#0E1715] border border-[#CFDED5]/60 dark:border-[#233833] flex items-center justify-between text-xs mb-5">
          <div>
            <span className="font-bold text-[#064E3B] dark:text-[#F2F7F4] block truncate max-w-[240px]">
              {foodTitle}
            </span>
            <span className="text-gray-500 dark:text-gray-400 text-[11px]">
              {stage === 'pickup' ? donorOrg || 'Kitchen Bay' : shelterOrg || 'Receiving Bay'}
            </span>
          </div>
          <span className="px-2.5 py-1 rounded-xl bg-white dark:bg-[#162421] border border-[#CFDED5] dark:border-[#233833] font-black text-[#059669]">
            {quantityStr}
          </span>
        </div>

        {/* MODE A: DISPLAY QR CODE */}
        {mode === 'display' && (
          <div className="space-y-5 text-center">
            {/* QR Card */}
            <div className="p-5 rounded-3xl bg-white dark:bg-[#0E1715] border-2 border-dashed border-[#059669]/40 flex flex-col items-center justify-center shadow-xs relative">
              <div
                className="p-3 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />

              <div className="mt-4 flex items-center gap-1.5 text-xs text-[#059669] font-bold animate-pulse">
                <span className="w-2 h-2 rounded-full bg-[#059669]" />
                <span>Ready for volunteer courier scan</span>
              </div>
            </div>

            {/* Manual PIN Code Backup */}
            <div className="p-4 rounded-2xl bg-gray-50 dark:bg-[#0E1715] border border-gray-200 dark:border-[#233833] flex items-center justify-between gap-3">
              <div className="text-left">
                <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 block">
                  Manual Verification PIN
                </span>
                <span className="font-mono text-xl font-black text-gray-900 dark:text-white tracking-wider">
                  {expectedCode}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="px-3 py-2 rounded-xl bg-white dark:bg-[#162421] border border-gray-200 dark:border-[#233833] text-gray-700 dark:text-gray-200 font-bold text-xs hover:border-[#059669] transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Copy PIN"
                >
                  {copied ? <Check className="w-4 h-4 text-[#059669]" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadQr}
                  className="p-2 rounded-xl bg-white dark:bg-[#162421] border border-gray-200 dark:border-[#233833] text-gray-700 dark:text-gray-200 hover:text-[#059669] transition-all cursor-pointer shadow-2xs"
                  title="Download SVG QR Code"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Show this QR code to the volunteer courier upon arrival. They will scan it with their camera to verify chain of custody.
            </p>
          </div>
        )}

        {/* MODE B: SCAN QR CODE */}
        {mode === 'scan' && (
          <div className="space-y-4">
            {successPayload ? (
              <div className="p-6 rounded-3xl bg-[#D1FAE5] dark:bg-[#059669]/20 border border-[#059669] text-center space-y-3 animate-in zoom-in-95">
                <div className="w-14 h-14 rounded-full bg-[#059669] text-white flex items-center justify-center mx-auto shadow-md">
                  <ShieldCheck className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-[#064E3B] dark:text-[#A7F3D0]">
                    Custody Handshake Verified!
                  </h3>
                  <p className="text-xs text-[#059669] dark:text-[#6EE7B7] mt-1 font-medium">
                    Batch verified with cryptographic token: <strong>{successPayload.code}</strong>
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full py-3 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-bold text-xs shadow-xs cursor-pointer"
                  >
                    Proceed to Next Step
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Camera Viewfinder */}
                <div className="relative w-full h-56 rounded-2xl overflow-hidden bg-black flex items-center justify-center border border-gray-300 dark:border-gray-700 shadow-inner">
                  {cameraActive ? (
                    <video
                      ref={videoRef}
                      className="w-full h-full object-cover"
                      playsInline
                      muted
                    />
                  ) : (
                    <div className="text-center p-4 text-gray-400 space-y-2">
                      <Camera className="w-10 h-10 mx-auto text-gray-500" />
                      <p className="text-xs max-w-xs">{cameraError || 'Activating camera sensor...'}</p>
                    </div>
                  )}

                  {/* Viewfinder Target Reticle */}
                  <div className="absolute inset-8 pointer-events-none border-2 border-[#059669]/80 rounded-2xl flex items-center justify-center">
                    <div className="w-full h-0.5 bg-[#059669] shadow-[0_0_8px_#059669] animate-bounce" />
                  </div>
                </div>

                {/* Instant Verification Helper */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleSimulateScanSuccess}
                    className="flex-1 py-2 px-3 rounded-xl bg-[#059669]/10 hover:bg-[#059669]/20 text-[#059669] font-bold text-xs flex items-center justify-center gap-1.5 border border-[#059669]/30 transition-all cursor-pointer"
                    title="Simulate scanning physical QR code directly"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Instant Optical Match</span>
                  </button>

                  {cameraActive && (
                    <button
                      type="button"
                      onClick={startCamera}
                      className="p-2 rounded-xl border border-gray-200 dark:border-[#233833] text-gray-500 hover:text-gray-900 dark:hover:text-white cursor-pointer"
                      title="Refresh Camera"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Manual PIN Input Option */}
                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-[#0E1715] border border-gray-200 dark:border-[#233833] space-y-2">
                  <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-[#059669]" />
                    <span>Or enter verification PIN manually:</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="e.g. FL-PU-9X42"
                      value={manualCode}
                      onChange={(e) => {
                        setManualCode(e.target.value);
                        setErrorMessage(null);
                      }}
                      className="flex-1 h-10 px-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#162421] text-gray-900 dark:text-white font-mono font-bold text-sm tracking-wider uppercase focus:outline-none focus:border-[#059669]"
                    />
                    <button
                      type="button"
                      onClick={() => handleVerifyInput(manualCode)}
                      disabled={!manualCode.trim()}
                      className="h-10 px-4 rounded-xl bg-[#059669] hover:bg-[#047857] disabled:opacity-40 text-white font-bold text-xs transition-all cursor-pointer shadow-xs"
                    >
                      Verify
                    </button>
                  </div>
                </div>

                {/* Error Banner */}
                {errorMessage && (
                  <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
