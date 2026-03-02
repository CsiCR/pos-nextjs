"use client";
import { ShieldAlert, Scale, ShieldCheck, Lock, FileText, ChevronRight } from "lucide-react";
import { APP_VERSION } from "@/lib/constants";

export default function LegalPage() {
    const lastUpdate = "01 de Marzo de 2026";

    return (
        <div className="max-w-4xl mx-auto space-y-12 pb-20 p-2 md:p-6">
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-black text-gray-900 tracking-tight">Información Legal y Seguridad</h1>
                <p className="text-gray-500 font-medium">Cumplimiento normativa República Argentina (Ley 25.326)</p>
                <div className="inline-block px-4 py-1 bg-gray-100 rounded-full text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                    Versión {APP_VERSION} • Actualizado: {lastUpdate}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-12">
                {/* Terminos y Condiciones */}
                <section className="space-y-6">
                    <div className="flex items-center gap-3 border-b-2 border-blue-600 pb-2">
                        <Scale className="w-6 h-6 text-blue-600" />
                        <h2 className="text-xl font-bold uppercase tracking-tight">Términos y Condiciones de Uso</h2>
                    </div>

                    <div className="prose prose-blue max-w-none text-gray-600 space-y-4">
                        <p>Los presentes Términos y Condiciones regulan el uso del sistema <strong>"Multirubro 24"</strong> (en adelante, el "Sistema").</p>

                        <div className="space-y-4">
                            <div className="flex gap-4">
                                <span className="font-bold text-blue-600 min-w-[20px]">1.</span>
                                <p><strong>Aceptación de los Términos:</strong> El acceso y uso del Sistema implica la aceptación plena de estos términos por parte del usuario y de la empresa contratante.</p>
                            </div>
                            <div className="flex gap-4">
                                <span className="font-bold text-blue-600 min-w-[20px]">2.</span>
                                <p><strong>Uso Licenciado:</strong> El Sistema se ofrece bajo una licencia de uso no exclusivo y limitado. El usuario se compromete a no realizar ingeniería inversa ni copiar el código fuente del mismo.</p>
                            </div>
                            <div className="flex gap-4">
                                <span className="font-bold text-blue-600 min-w-[20px]">3.</span>
                                <p><strong>Responsabilidad del Usuario:</strong> El usuario es responsable de la veracidad de los datos ingresados (precios, stock, ventas) y del uso de sus credenciales de acceso. El Sistema no se hace responsable por errores de carga humana.</p>
                            </div>
                            <div className="flex gap-4">
                                <span className="font-bold text-blue-600 min-w-[20px]">4.</span>
                                <p><strong>Disponibilidad:</strong> Si bien trabajamos para garantizar un 99.9% de uptime, no garantizamos el funcionamiento ininterrumpido ante fallas de proveedores externos (internet, servidores de terceros).</p>
                            </div>
                            <div className="flex gap-4">
                                <span className="font-bold text-blue-600 min-w-[20px]">5.</span>
                                <p><strong>Limitación de Responsabilidad:</strong> Bajo ninguna circunstancia el Sistema será responsable por daños indirectos, pérdida de ganancias o pérdida de datos resultante de un uso inadecuado o ataques externos no previstos.</p>
                            </div>
                            <div className="flex gap-4">
                                <span className="font-bold text-blue-600 min-w-[20px]">6.</span>
                                <p><strong>Jurisdicción:</strong> Cualquier controversia será sometida a los Tribunales Ordinarios de la <strong>Ciudad de Comodoro Rivadavia, Provincia del Chubut</strong>, renunciando a cualquier otro fuero.</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Políticas de Seguridad */}
                <section className="space-y-6">
                    <div className="flex items-center gap-3 border-b-2 border-green-600 pb-2">
                        <ShieldCheck className="w-6 h-6 text-green-600" />
                        <h2 className="text-xl font-bold uppercase tracking-tight">Seguridad y Privacidad (Ley 25.326)</h2>
                    </div>

                    <div className="bg-green-50 border border-green-100 p-6 rounded-3xl space-y-4">
                        <div className="flex items-start gap-4">
                            <div className="bg-white p-2 rounded-xl shadow-sm">
                                <Lock className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                                <h3 className="font-bold text-green-800">Protección de Datos Personales</h3>
                                <p className="text-sm text-green-700/80 mt-1">
                                    En cumplimiento con la Ley 25.326 de la República Argentina, garantizamos el tratamiento seguro de su información.
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                            {[
                                { title: "Cifrado SSL/TLS", desc: "Transmisión segura de datos punta a punta." },
                                { title: "Tokens JWT", desc: "Autenticación robusta y sesiones blindadas." },
                                { title: "Redundancia", desc: "Copias de seguridad automáticas diarias." },
                                { title: "Derechos ARCO", desc: "Acceso, rectificación y supresión garantizada." }
                            ].map((item, idx) => (
                                <div key={idx} className="bg-white/50 p-4 rounded-2xl border border-white flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                    <div>
                                        <p className="font-bold text-xs text-gray-800 uppercase tracking-tight">{item.title}</p>
                                        <p className="text-[11px] text-gray-500 leading-tight">{item.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <p className="text-xs text-green-800 font-medium bg-white/40 p-3 rounded-xl">
                            * El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a los mismos en forma gratuita a intervalos no inferiores a seis meses, salvo que se acredite un interés legítimo al efecto conforme lo establecido en el artículo 14, inciso 3 de la Ley Nº 25.326.
                        </p>
                    </div>
                </section>
            </div>

            <div className="bg-gray-900 rounded-3xl p-8 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
                <div className="space-y-2 text-center md:text-left">
                    <p className="flex items-center justify-center md:justify-start gap-2 text-gray-400 font-bold uppercase text-[10px] tracking-widest">
                        <ShieldAlert className="w-4 h-4 text-orange-500" /> Aviso Importante
                    </p>
                    <p className="text-sm text-gray-300 leading-relaxed max-w-md italic">
                        "Este documento es una guía de carácter legal. Para consultas específicas sobre su cuenta, contacte al soporte técnico de su organización."
                    </p>
                </div>
                <div className="flex flex-col items-center gap-2">
                    <span className="text-[10px] uppercase font-black tracking-tighter text-gray-500">Multirubro 24 POS</span>
                    <img src="/logo.png" className="w-12 h-12 grayscale opacity-50" alt="Logo" />
                </div>
            </div>
        </div>
    );
}
