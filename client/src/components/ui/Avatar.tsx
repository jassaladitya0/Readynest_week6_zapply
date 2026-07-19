
export const Avatar = ({ src, name, size = 'md', showStatus = false, status = 'offline' }: any) => {
  const sizeMap = { sm: 'w-8 h-8 text-sm', md: 'w-12 h-12 text-base', lg: 'w-16 h-16 text-xl' };
  return (
    <div className="relative inline-block">
      <div className={`${sizeMap[size as keyof typeof sizeMap]} rounded-full bg-gradient-to-tr from-purple-500 to-cyan-500 flex items-center justify-center font-bold overflow-hidden shadow-lg`}>
        {src ? <img src={src} alt={name} className="w-full h-full object-cover" /> : name?.[0]?.toUpperCase()}
      </div>
      {showStatus && (
        <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-black ${status === 'online' ? 'bg-green-500' : 'bg-gray-500'}`} />
      )}
    </div>
  );
};
