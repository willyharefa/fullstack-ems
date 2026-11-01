import { LogOutIcon } from "lucide-react";

export default function LogoutModal({ open, onClose, onConfirm, loading = false }) {
    if ( !open ) return null;

    return (
        <div
            // klik area gelap di luar = batal
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-fade-in"
                onClick={(e) => e.stopPropagation()} // klik di dalam dialog TIDAK menutup
            >
                <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center mb-4">
                        <LogOutIcon className="w-6 h-6 text-rose-600" />
                    </div>

                    <h2 className="text-lg font-semibold text-slate-800">Log out?</h2>
                    <p className="text-sm text-slate-500 mt-2">
                        Are you sure to log out?
                    </p>

                    <div className="flex gap-3 w-full mt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={onConfirm}
                            disabled={loading}
                            className="flex-1 py-2.5 rounded-lg bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-50 transition-colors cursor-pointer"
                        >
                            {loading ? "Logging out..." : "Yes, log out"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}