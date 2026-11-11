export default function FiltroPrestadores({ prestamistas, filtro, onCambiar }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {[{ id: 'todos', nombre: 'Todos' }, ...prestamistas].map(p => (
        <button
          key={p.id}
          onClick={() => onCambiar(p.id)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filtro === p.id ? 'bg-blue-800 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          {p.nombre}
        </button>
      ))}
    </div>
  )
}
