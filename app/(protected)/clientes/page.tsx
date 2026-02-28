"use client";
import { AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ClientsPage() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
            <div className="w-20 h-20 bg-orange-100 rounded-3xl flex items-center justify-center mb-6">
                <AlertCircle className="w-10 h-10 text-orange-600" />
            </div>
            <h1 className="text-3xl font-black text-gray-900 mb-2">Módulo Desactivado</h1>
            <p className="text-gray-500 max-w-md mb-8">
                El módulo de <b>Cuentas Corrientes</b> ha sido desactivado temporalmente para garantizar la estabilidad del sistema en producción.
                Se reestablecerá una vez completada la migración de base de datos correspondiente.
            </p>
            <Link href="/dashboard" className="btn btn-primary flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" /> Volver al Dashboard
            </Link>
        </div>
    );
}
