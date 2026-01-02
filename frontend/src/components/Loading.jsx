export default function Loading() {
  return (
    <div className="min-h-screen bg-gradient-dark flex items-center justify-center">
      <div className="text-center">
        <div className="relative w-16 h-16 mx-auto mb-4">
          <div className="absolute inset-0 border-4 border-dark-700 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-t-accent-primary rounded-full animate-spin"></div>
        </div>
        <p className="text-gray-400 text-sm">Cargando...</p>
      </div>
    </div>
  );
}
