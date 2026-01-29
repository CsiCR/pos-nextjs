"use client";
import { useEffect, useRef, useState } from "react";
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { X } from "lucide-react";

interface BarcodeScannerProps {
    onScanSuccess: (decodedText: string, decodedResult: any) => void;
    onScanFailure?: (error: any) => void;
    onClose: () => void;
}

export const BarcodeScanner = ({ onScanSuccess, onScanFailure, onClose }: BarcodeScannerProps) => {
    const scannerRef = useRef<Html5QrcodeScanner | null>(null);

    useEffect(() => {
        // Initialize Scanner
        // Use a unique ID for the container
        const scannerId = "reader";

        if (!scannerRef.current) {
            const scanner = new Html5QrcodeScanner(
                scannerId,
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1.0,
                    showTorchButtonIfSupported: true,
                    formatsToSupport: [
                        Html5QrcodeSupportedFormats.EAN_13,
                        Html5QrcodeSupportedFormats.EAN_8,
                        Html5QrcodeSupportedFormats.UPC_A,
                        Html5QrcodeSupportedFormats.UPC_E,
                        Html5QrcodeSupportedFormats.CODE_128,
                        Html5QrcodeSupportedFormats.CODE_39
                    ]
                },
                /* verbose= */ false
            );

            scanner.render(
                (decodedText, decodedResult) => {
                    // Success callback
                    onScanSuccess(decodedText, decodedResult);
                    // Optional: Stop scanning automatically? usually yes for single scan
                    // scanner.clear(); 
                },
                (errorMessage) => {
                    // Error callback
                    if (onScanFailure) onScanFailure(errorMessage);
                }
            );

            scannerRef.current = scanner;
        }

        return () => {
            if (scannerRef.current) {
                scannerRef.current.clear().catch(error => {
                    console.error("Failed to clear html5-qrcode scanner. ", error);
                });
            }
        };
    }, []);

    return (
        <div className="fixed inset-0 z-[60] bg-black/90 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-2xl overflow-hidden relative">
                <div className="p-4 flex items-center justify-between border-b">
                    <h3 className="font-bold text-gray-800">Escanear Código</h3>
                    <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition">
                        <X className="w-5 h-5 text-gray-600" />
                    </button>
                </div>

                <div className="p-4" style={{ minHeight: '350px' }}>
                    <div id="reader" className="w-full h-full"></div>
                </div>

                <div className="p-4 bg-gray-50 text-center text-sm text-gray-500">
                    Apunta la cámara al código de barras
                </div>
            </div>
        </div>
    );
};
