'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCcw } from 'lucide-react';

export default function DashboardError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Dashboard Error:', error);
    }, [error]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center space-y-6 bg-white rounded-2xl shadow-sm border border-red-100">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-600" />
            </div>

            <div className="space-y-2">
                <h2 className="text-2xl font-bold text-gray-900">Algo salió mal en el Dashboard</h2>
                <p className="text-gray-500 max-w-sm mx-auto">
                    Ocurrió un error inesperado al cargar las estadísticas. Esto puede deberse a un problema de conexión o una sesión expirada.
                </p>
            </div>

            <div className="bg-red-50 p-4 rounded-xl text-xs text-red-800 font-mono text-left max-w-md w-full overflow-auto">
                <strong>Detalle del error:</strong>
                <p className="mt-1">{error.message || 'Error desconocido'}</p>
                {error.digest && <p className="mt-1 text-[10px] opacity-70">ID: {error.digest}</p>}
            </div>

            <button
                onClick={() => reset()}
                className="btn btn-primary px-8 shadow-lg shadow-blue-200"
            >
                <RefreshCcw className="w-4 h-4" />
                Intentar de nuevo
            </button>
        </div>
    );
}
