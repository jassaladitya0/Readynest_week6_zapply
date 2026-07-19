
export const ConfirmDialog = ({ isOpen, onClose, onConfirm, title, message }: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="glass p-6 rounded-2xl max-w-sm w-full">
        <h3 className="text-xl font-bold mb-2">{title}</h3>
        <p className="text-gray-400 mb-6">{message}</p>
        <div className="flex gap-4 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded font-bold hover:bg-white/10">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 bg-red-600 rounded font-bold hover:bg-red-700">Confirm</button>
        </div>
      </div>
    </div>
  );
};
