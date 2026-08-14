import { useState } from 'react';
import axios from 'axios';

const PLATE_REGEX = /^(?=.*[A-Z])(?=.*\d)[A-Z0-9]{5,9}$/;

export function AccessForm({ whitelist, API_URL, customSwal }) {
  const [plate, setPlate] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [validUntil, setValidUntil] = useState('');

  const handlePlateChange = (e) => {
    const inputPlate = e.target.value.toUpperCase();
    setPlate(inputPlate);

    // Autocompletado si la matrícula ya existe
    const existingRecord = whitelist.find(item => item.plate === inputPlate);
    if (existingRecord) {
      setOwnerName(existingRecord.owner_name || '');
      if (existingRecord.valid_until) {
        const d = new Date(existingRecord.valid_until);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        setValidUntil(`${year}-${month}-${day}T${hours}:${minutes}`);
      } else {
        setValidUntil('');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanPlate = plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

    if (!PLATE_REGEX.test(cleanPlate)) {
      customSwal.fire({ title: "Formato Inválido", text: "La matrícula debe tener entre 5 y 9 caracteres (números y letras).", toast: true, position: "top-end", icon: "warning", showConfirmButton: false, timer: 2500, timerProgressBar: true });
      return;
    }
    if (!ownerName.trim()) {
      customSwal.fire({ title: "Dato faltante", text: "Debe introducir el nombre del titular.", toast: true, position: "top-end", icon: "warning", showConfirmButton: false, timer: 2500, timerProgressBar: true });
      return;
    }

    try {
      await axios.post(`${API_URL}/api/v1/whitelist`, {
        plate: cleanPlate, owner_name: ownerName, valid_until: validUntil ? new Date(validUntil).toISOString() : null
      });
      customSwal.fire({ title: "Éxito", text: `Matrícula guardada`, toast: true, position: "top-end", icon: "success", showConfirmButton: false, timer: 1500, timerProgressBar: true });
      setPlate('');
      setOwnerName('');
      setValidUntil('');
    } catch (error) {
      customSwal.fire({ title: "Error", text: error.response?.data?.error || "Error al añadir", toast: true, position: "top-end", icon: "error", showConfirmButton: false, timer: 1500, timerProgressBar: true });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 mb-8 bg-zinc-50 dark:bg-zinc-950/30 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800/50 transition-colors">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wider transition-colors">Matrícula</label>
          <input type="text" value={plate} onChange={handlePlateChange} placeholder="AB-123-CD" maxLength={11} required className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-white text-sm px-4 py-2.5 rounded-lg focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-500 transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-600 font-mono tracking-widest" />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wider transition-colors">Titular</label>
          <input type="text" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Nombre y Apellidos" required className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-white text-sm px-4 py-2.5 rounded-lg focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-500 transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-600" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wider transition-colors">Caducidad (Opcional)</label>
        <input type="datetime-local" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-zinc-300 text-sm px-4 py-2.5 rounded-lg focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-500 transition-all [color-scheme:light] dark:[color-scheme:dark]" />
      </div>
      <button type="submit" className="mt-2 w-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 px-6 py-2.5 rounded-lg font-semibold hover:bg-zinc-800 dark:hover:bg-white active:scale-95 transition-all cursor-pointer">
        Guardar / Actualizar Permiso
      </button>
    </form>
  );
}
