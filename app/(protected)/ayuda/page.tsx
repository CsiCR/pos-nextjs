"use client";
import {
    Book,
    Settings,
    Users,
    ShoppingCart,
    Package,
    Clock,
    Truck,
    DollarSign,
    CheckCircle2,
    AlertCircle,
    PlayCircle,
    Flag,
    Scale,
    ChevronRight,
    Info
} from "lucide-react";
import Link from "next/link";
import { APP_VERSION } from "@/lib/constants";
import { useSettings } from "@/hooks/use-settings";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

export default function AyudaPage() {
    const { settings } = useSettings();

    const sections = [
        {
            title: "1. Configuración Inicial",
            icon: Settings,
            color: "text-blue-600",
            bg: "bg-blue-50",
            items: [
                {
                    label: "Sedes",
                    desc: "Gestiona ubicaciones físicas.",
                    href: "/sucursales",
                    tooltip: "Permite dar de alta y administrar las diferentes sucursales o puntos de venta de tu negocio."
                },
                {
                    label: "Usuarios",
                    desc: "Control de personal y permisos.",
                    href: "/usuarios",
                    tooltip: "Administra quién tiene acceso al sistema y qué acciones puede realizar según su rol (Cajero, Supervisor, Admin)."
                },
                {
                    label: "Categorías",
                    desc: "Organización del inventario.",
                    href: "/productos",
                    tooltip: "Agrupa tus productos por rubros para facilitar la búsqueda y los reportes de stock."
                },
                {
                    label: "Listas de Precios",
                    desc: "Precios mayoristas/minoristas.",
                    href: "/listas-precios",
                    tooltip: "Configura diferentes valores para un mismo producto según el tipo de cliente o canal de venta."
                }
            ]
        },
        {
            title: "2. Operación Diaria",
            icon: PlayCircle,
            color: "text-green-600",
            bg: "bg-green-50",
            items: [
                {
                    label: "Turnos",
                    desc: "Control de caja y fondo inicial.",
                    href: "/turnos",
                    tooltip: "Registro obligatorio de apertura y cierre para auditar el efectivo y las ventas de cada jornada."
                },
                {
                    label: "Ventas (POS)",
                    desc: "Módulo principal de atención.",
                    href: "/pos",
                    tooltip: "Interfaz rápida para facturar, aplicar descuentos y procesar múltiples métodos de pago."
                },
                {
                    label: "Historial",
                    desc: "Consulta y reimpresión.",
                    href: "/historial",
                    tooltip: "Acceso a todos los comprobantes emitidos para devoluciones o auditoría de transacciones."
                }
            ]
        },
        {
            title: "3. Mercadería y Logística",
            icon: Package,
            color: "text-orange-600",
            bg: "bg-orange-50",
            items: [
                {
                    label: "Inventario",
                    desc: "Control central de stock.",
                    href: "/productos",
                    tooltip: "Visualiza cantidades disponibles, configura stock mínimo y activa/desactiva productos."
                },
                ...(settings.isClearingEnabled ? [{
                    label: "Logística",
                    desc: "Movimientos entre sucursales.",
                    href: "/logistica",
                    tooltip: "Gestiona el envío y recepción de mercadería entre tus sedes con control de stock inter-sucursal."
                }] : [])
            ]
        },
        {
            title: "4. Clientes y Finanzas",
            icon: Users,
            color: "text-purple-600",
            bg: "bg-purple-50",
            items: [
                ...(settings.enableCustomerAccounts ? [{
                    label: "Cuentas Corrientes",
                    desc: "Gestión de deudas y saldos.",
                    href: "/clientes",
                    tooltip: "Lleva el control de saldos pendientes, límites de crédito y pagos realizados por tus clientes habituales."
                }] : []),
                {
                    label: "Verificador",
                    desc: "Consulta rápida de precios.",
                    href: "/verificador",
                    tooltip: "Herramienta ágil para consultar precios y stock de productos sin iniciar una venta."
                }
            ]
        },
        {
            title: "5. Legal y Privacidad",
            icon: Scale,
            color: "text-gray-600",
            bg: "bg-gray-50",
            items: [
                {
                    label: "Términos de Uso",
                    desc: "Condiciones del servicio.",
                    href: "/legal",
                    tooltip: "Documentación sobre los alcances, responsabilidades y jurisdicción legal del uso del sistema."
                },
                {
                    label: "Protección de Datos",
                    desc: "Seguridad y Ley 25.326.",
                    href: "/legal",
                    tooltip: "Información sobre cómo protegemos la privacidad de tu información y la de tus clientes según la ley argentina."
                }
            ]
        }
    ];

    return (
        <TooltipProvider delayDuration={300}>
            <div className="max-w-6xl mx-auto space-y-8 pb-12 p-2">
                <div className="flex items-center gap-4 border-b pb-6">
                    <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-100">
                        <Book className="w-10 h-10 text-white" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black text-gray-900 tracking-tight">Centro de Ayuda</h1>
                        <p className="text-gray-500 font-medium">Librería de recursos y accesos directos configurados</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {sections.map((section, idx) => (
                        <div key={idx} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                            <div className={`p-4 ${section.bg} flex items-center gap-3 border-b border-white`}>
                                <section.icon className={`w-6 h-6 ${section.color}`} />
                                <h2 className={`font-black uppercase tracking-wider text-xs ${section.color}`}>{section.title}</h2>
                            </div>
                            <div className="p-4 space-y-2 flex-1">
                                {section.items.map((item, iidx) => (
                                    <Tooltip key={iidx}>
                                        <TooltipTrigger asChild>
                                            <Link
                                                href={item.href}
                                                className="group flex items-center gap-3 p-3 rounded-2xl hover:bg-gray-50 transition-all border border-transparent hover:border-gray-100"
                                            >
                                                <div className="mt-0.5 relative">
                                                    <CheckCircle2 className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition-colors" />
                                                </div>
                                                <div className="flex-1">
                                                    <h3 className="font-bold text-gray-800 text-sm group-hover:text-blue-600 transition-colors uppercase tracking-tight flex items-center gap-2">
                                                        {item.label}
                                                    </h3>
                                                    <p className="text-[11px] text-gray-400 group-hover:text-gray-500 leading-tight">{item.desc}</p>
                                                </div>
                                                <ChevronRight className="w-4 h-4 text-gray-200 group-hover:text-gray-400 group-hover:translate-x-1 transition-all" />
                                            </Link>
                                        </TooltipTrigger>
                                        <TooltipContent side="right" className="max-w-[250px] bg-gray-900 text-white p-3 rounded-xl border-gray-800 shadow-2xl">
                                            <div className="flex gap-2">
                                                <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                                                <p className="text-xs font-medium leading-relaxed">{item.tooltip}</p>
                                            </div>
                                        </TooltipContent>
                                    </Tooltip>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="bg-blue-600 rounded-3xl p-8 text-white relative overflow-hidden shadow-xl shadow-blue-100 mt-12">
                    <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="text-center md:text-left">
                            <h2 className="text-2xl font-black mb-2 flex items-center justify-center md:justify-start gap-2">
                                <Flag className="w-6 h-6" /> Ayuda Multirubro 24
                            </h2>
                            <p className="text-blue-100 font-medium italic opacity-90 text-sm">
                                "Pasa el cursor sobre los elementos para obtener más información técnica."
                            </p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 text-center min-w-[200px]">
                            <p className="text-[10px] font-black uppercase tracking-widest text-blue-200 mb-1">Versión del Sistema</p>
                            <p className="text-xl font-black">{APP_VERSION}</p>
                        </div>
                    </div>
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl"></div>
                </div>
            </div>
        </TooltipProvider>
    );
}
