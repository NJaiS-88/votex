const VideoTile = ({ title, subtitle, videoRef, muted = false }) => {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
      <div className="aspect-video bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="flex items-center justify-between px-3 py-2 text-sm">
        <span className="font-medium text-slate-100">{title}</span>
        {subtitle ? <span className="text-slate-400">{subtitle}</span> : null}
      </div>
    </div>
  );
};

export default VideoTile;
